import { Injectable, Logger } from '@nestjs/common';
import {
  CatalogService,
  entraEnCatalogoMeta,
} from '../catalog/catalog.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { MENSAJE_DERIVACION } from './aviso-equipo.service';
import { contieneNumeroNoVerificado } from './busqueda-productos';
import {
  CalculoPedidoBotService,
  type ResultadoCalculo,
} from './calculo-pedido-bot.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { textoDe } from './datos-pedido-bot';
import {
  ConversacionesService,
  type CanalMensajeria,
} from './conversaciones.service';
import {
  GeminiClienteService,
  type PasoFunctionCall,
  type PasoModelOutput,
  type RespuestaInteraction,
} from './gemini-cliente.service';
import {
  HERRAMIENTAS,
  NOMBRE_NEGOCIO,
  SYSTEM_INSTRUCTION,
  URL_CATALOGO,
} from './gemini-prompt';
import { HerramientasBotService } from './herramientas-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import { MetaGraphService } from './meta-graph.service';
import { armarResumenPedido } from './resumen-pedido';
import {
  elegirProductos,
  seccionesPorCategoria,
  tarjetasDe,
} from './seleccion-productos';

const MAX_TURNOS_HERRAMIENTAS = 4;
const LIMITE_MENSAJES_VENTANA_MINUTOS = 60;
const LIMITE_MENSAJES_MAX = 40;
// WhatsApp rechaza mensajes de más de 4096 caracteres.
const MAX_LARGO_MENSAJE_WHATSAPP = 4096;
const MAX_LOG_RESULTADO = 160;

/**
 * El modelo tiene la instrucción de usar un solo asterisco (el formato real
 * de WhatsApp), pero en la práctica sigue devolviendo negrita estilo
 * Markdown (**texto**) y viñetas ("* texto") con bastante frecuencia — un
 * "lite" no obedece esto de forma confiable solo con el prompt. Se corrige
 * acá, determinístico, en vez de confiar en que el modelo lo haga bien.
 */
function formatearParaWhatsapp(texto: string): string {
  return texto
    .replace(/^[ \t]*\*[ \t]+/gm, '- ')
    .replace(/\*\*(.+?)\*\*/g, '*$1*');
}

/**
 * Function-calling contra la Interactions API de Gemini, con memoria de
 * conversación entre mensajes separados vía `previous_interaction_id`
 * (persistido en conversaciones_bot). El modelo decide qué herramienta
 * llamar, pero el dato real siempre sale de Supabase vía los mismos
 * servicios que ya usa el resto del sistema — nunca inventa precios,
 * horarios, ni suma totales por su cuenta.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly cliente: GeminiClienteService,
    private readonly catalog: CatalogService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly checkout: CheckoutWhatsappService,
    private readonly herramientas: HerramientasBotService,
    private readonly calculo: CalculoPedidoBotService,
  ) {}

  /**
   * Devuelve `null` cuando la herramienta ya mandó el mensaje ella misma
   * (el botón de catálogo) — en ese caso no hay que enviar nada más.
   */
  async responder(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    textoEntrante: string,
    conversacionId: string,
  ): Promise<string | null> {
    if (!this.cliente.configurado) {
      return 'En este momento no puedo responder automáticamente — escribí *humano* para que te atienda alguien del equipo.';
    }

    try {
      const dentroDelLimite =
        await this.conversaciones.dentroDelLimiteDeMensajes(
          canal,
          identificadorExterno,
          LIMITE_MENSAJES_VENTANA_MINUTOS,
          LIMITE_MENSAJES_MAX,
        );
      if (!dentroDelLimite) {
        this.logger.warn(
          `Límite de mensajes excedido — canal=${canal} id=${identificadorExterno}`,
        );
        return this.truncarParaWhatsapp(
          'Estás mandando muchos mensajes seguidos — dame un momento o escribí *humano* para que te atienda alguien del equipo.',
        );
      }

      const respuestaFinal = await this.conversarConGemini(
        { canal, identificadorExterno, telefono, conversacionId },
        textoEntrante,
      );
      return respuestaFinal === null
        ? null
        : this.truncarParaWhatsapp(respuestaFinal);
    } catch (err) {
      this.logger.error(
        `Error respondiendo a canal=${canal} id=${identificadorExterno}: ${(err as Error).message}`,
      );
      return 'Perdón, tuve un problema para procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.';
    }
  }

  transcribirAudio(datos: Buffer, mime: string): Promise<string | null> {
    return this.cliente.transcribirAudio(datos, mime);
  }

  private truncarParaWhatsapp(texto: string): string {
    if (texto.length <= MAX_LARGO_MENSAJE_WHATSAPP) return texto;
    return `${texto.slice(0, MAX_LARGO_MENSAJE_WHATSAPP - 1)}…`;
  }

  private async conversarConGemini(
    ctx: ContextoHerramienta,
    textoEntrante: string,
  ): Promise<string | null> {
    const { canal, identificadorExterno } = ctx;
    let respuesta = await this.llamadaInicial(ctx, textoEntrante);

    let derivadoEnEsteTurno = false;
    // Fuentes válidas para un número largo en la respuesta: lo que devolvió
    // una herramienta en este turno, o lo que acaba de escribir el cliente.
    const resultadosHerramientas: string[] = [textoEntrante];

    for (let turno = 0; turno < MAX_TURNOS_HERRAMIENTAS; turno++) {
      // (respuesta.steps ?? []) — la Interactions API de Gemini está en
      // beta y en algún response real llegó sin steps, tirando "Cannot
      // read properties of undefined (reading 'find')" (visto en logs de
      // producción); mejor tratarlo como "sin function_call" que romper
      // la conversación con un error genérico.
      const llamada = (respuesta.steps ?? []).find(
        (p): p is PasoFunctionCall => p.type === 'function_call',
      );
      if (!llamada || respuesta.status !== 'requires_action') break;

      // Estas dos mandan el mensaje ellas mismas: no queda nada por responder.
      if (await this.mandoElMensaje(llamada, ctx, respuesta.id)) return null;

      if (llamada.name === 'derivar_a_humano') derivadoEnEsteTurno = true;
      const resultado = await this.resultadoDeHerramienta(
        llamada,
        ctx,
        respuesta.id,
      );
      if (resultado === null) return null;
      resultadosHerramientas.push(resultado);
      // Solo la primera línea: el resumen de calcular_pedido trae nombre y
      // dirección del cliente en las siguientes.
      this.logger.log(
        `id=${identificadorExterno} herramienta=${llamada.name} → ${resultado.split('\n')[0].slice(0, MAX_LOG_RESULTADO)}`,
      );

      respuesta = await this.cliente.llamar({
        model: this.cliente.modelo,
        previous_interaction_id: respuesta.id,
        input: {
          type: 'function_result',
          call_id: llamada.id,
          name: llamada.name,
          result: [{ type: 'text', text: resultado }],
        },
      });
    }

    // Si se derivó a humano, derivarAHumano() ya dejó gemini_interaction_id
    // en null a propósito — no lo pisamos acá, así la próxima vez que el
    // bot retome la conversación arranca de cero.
    if (!derivadoEnEsteTurno) {
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        respuesta.id,
      );
    }
    this.registrarUso(canal, identificadorExterno, respuesta);
    return this.textoFinal(respuesta, resultadosHerramientas, ctx);
  }

  private async llamadaInicial(
    ctx: ContextoHerramienta,
    textoEntrante: string,
  ): Promise<RespuestaInteraction> {
    const interaccionPrevia =
      await this.conversaciones.obtenerUltimaInteraccionGemini(
        ctx.canal,
        ctx.identificadorExterno,
      );
    return this.cliente.llamar({
      model: this.cliente.modelo,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: HERRAMIENTAS,
      ...(interaccionPrevia
        ? { previous_interaction_id: interaccionPrevia, input: textoEntrante }
        : { input: textoEntrante }),
    });
  }

  private registrarUso(
    canal: CanalMensajeria,
    identificadorExterno: string,
    respuesta: RespuestaInteraction,
  ): void {
    this.logger.log(
      `canal=${canal} id=${identificadorExterno} modelo=${respuesta.model ?? this.cliente.modelo}` +
        (respuesta.usage
          ? ` tokens_in=${respuesta.usage.input_tokens ?? '?'} tokens_out=${respuesta.usage.output_tokens ?? '?'}`
          : ''),
    );
  }

  private async textoFinal(
    respuesta: RespuestaInteraction,
    resultadosHerramientas: string[],
    ctx: ContextoHerramienta,
  ): Promise<string> {
    const salida = (respuesta.steps ?? []).find(
      (p): p is PasoModelOutput => p.type === 'model_output',
    );
    const texto = salida?.content[0]?.text;
    if (texto && contieneNumeroNoVerificado(texto, resultadosHerramientas)) {
      // Un número largo (cuenta, Nequi, teléfono) que ninguna herramienta
      // devolvió es un dato inventado: no se manda, y una persona sigue.
      this.logger.warn(
        `id=${ctx.identificadorExterno} respuesta bloqueada: número no verificado — se deriva a una persona.`,
      );
      await this.herramientas.ejecutar('derivar_a_humano', {}, ctx);
      return MENSAJE_DERIVACION;
    }
    return formatearParaWhatsapp(
      texto ??
        'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.',
    );
  }

  /**
   * `enviar_catalogo` y `mostrar_productos` mandan su propio mensaje a
   * WhatsApp: se registra lo enviado y se guarda la interacción. Devuelve
   * true si la llamada era una de esas dos.
   */
  private async mandoElMensaje(
    llamada: PasoFunctionCall,
    ctx: ContextoHerramienta,
    interaccionId: string,
  ): Promise<boolean> {
    const { canal, identificadorExterno, conversacionId } = ctx;
    let registro: string | null;
    if (llamada.name === 'enviar_catalogo') {
      const enviado = await this.metaGraph.enviarCatalogo(
        canal,
        identificadorExterno,
        URL_CATALOGO,
        await this.retailerIdMiniatura(),
      );
      registro =
        enviado === 'catalogo'
          ? 'Menú enviado como catálogo de WhatsApp.'
          : `Mirá nuestro catálogo completo con fotos y precios acá: ${URL_CATALOGO}`;
    } else if (llamada.name === 'mostrar_productos') {
      const mostrados = await this.enviarProductos(
        canal,
        identificadorExterno,
        textoDe(llamada.arguments.consulta),
      );
      registro =
        mostrados.length > 0
          ? `Productos mostrados: ${mostrados.join(', ')}`
          : null;
    } else {
      return false;
    }
    if (registro) {
      await this.conversaciones.registrarMensaje(
        conversacionId,
        'saliente_bot',
        registro,
      );
    }
    await this.conversaciones.guardarInteraccionGemini(
      canal,
      identificadorExterno,
      interaccionId,
    );
    return true;
  }

  /**
   * Texto que se le devuelve al modelo como resultado de la herramienta.
   * `null` cuando `calcular_pedido` ya le mandó el resumen al cliente por
   * su cuenta y no hay nada más que contestar.
   */
  private async resultadoDeHerramienta(
    llamada: PasoFunctionCall,
    ctx: ContextoHerramienta,
    interaccionId: string,
  ): Promise<string | null> {
    if (llamada.name !== 'calcular_pedido') {
      return this.herramientas.ejecutar(llamada.name, llamada.arguments, ctx);
    }
    const calculo = await this.calculo.calcular(
      llamada.arguments,
      ctx.canal,
      ctx.identificadorExterno,
    );
    if (!calculo.ok) return calculo.texto;
    await this.enviarResumenPedido(ctx, calculo, interaccionId, llamada.id);
    return null;
  }

  /** Variante del primer producto destacado del catálogo, para la portada. */
  private async retailerIdMiniatura(): Promise<string | undefined> {
    const productos = await this.catalog.getProductos();
    return productos.find(entraEnCatalogoMeta)?.variantes[0]?.id;
  }

  /**
   * Elige los productos que matchean `consulta`: primero por categoría
   * ("pizzas", "bebidas"), después por palabras del nombre/descripción
   * ordenadas por puntaje; si nada matchea o viene vacía, se usa el orden
   * por defecto de getProductos() (destacado primero — los productos ancla
   * confirmados en CLAUDE.md). En WhatsApp va como lista nativa del
   * catálogo agrupada por categoría; si no se puede, hasta 3 tarjetas.
   * Devuelve los nombres de lo que se mostró.
   */
  private async enviarProductos(
    canal: CanalMensajeria,
    identificadorExterno: string,
    consulta: string,
  ): Promise<string[]> {
    const [productos, categorias] = await Promise.all([
      this.catalog.getProductos(),
      this.catalog.getCategorias(),
    ]);
    if (productos.length === 0) return [];

    const elegidos = elegirProductos(productos, categorias, consulta);
    const tarjetas = tarjetasDe(elegidos);
    const secciones = seccionesPorCategoria(elegidos, categorias);

    const enviado = await this.metaGraph.enviarListaProductos(
      canal,
      identificadorExterno,
      {
        encabezado:
          secciones.length === 1 ? secciones[0].titulo : NOMBRE_NEGOCIO,
        cuerpo: 'Tocá un producto para ver el detalle y agregalo al carrito 🛒',
        secciones: secciones.map((s) => ({
          titulo: s.titulo,
          retailerIds: s.productos.flatMap((p) => p.variantes.map((v) => v.id)),
        })),
      },
      tarjetas,
    );
    return enviado === 'lista'
      ? secciones.flatMap((s) => s.productos.map((p) => p.nombre))
      : tarjetas.map((t) => t.nombre);
  }

  /**
   * Manda el resumen armado por código y le avisa a Gemini que ya se envió.
   * En WhatsApp pasa al checkout con botones (paso de pago): el pedido se
   * crea con un toque, sin que el modelo intervenga. En Messenger/Instagram
   * se pregunta el pago por texto. Lo que Gemini conteste al aviso no se
   * manda al cliente.
   */
  private async enviarResumenPedido(
    ctx: ContextoHerramienta,
    calculo: Extract<ResultadoCalculo, { ok: true }>,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    const { canal, identificadorExterno, conversacionId } = ctx;
    const resumen =
      canal === 'whatsapp'
        ? await this.checkout.ofrecerPagoDesdeCalculo({
            identificadorExterno,
            conversacionId,
            items: calculo.items,
            checkout: { paso: 'pago', ...calculo.datos },
          })
        : await this.enviarResumenPorTexto(ctx, calculo);
    this.logger.log(
      `id=${identificadorExterno} herramienta=calcular_pedido → resumen enviado por el sistema`,
    );
    await this.avisarResumen(ctx, resumen, interaccionId, llamadaId);
  }

  /** Le cuenta a Gemini que el sistema ya mandó el resumen; su respuesta no llega al cliente. */
  private async avisarResumen(
    ctx: ContextoHerramienta,
    resumen: string,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    const { canal, identificadorExterno } = ctx;
    try {
      const aviso = await this.cliente.llamar({
        model: this.cliente.modelo,
        previous_interaction_id: interaccionId,
        input: {
          type: 'function_result',
          call_id: llamadaId,
          name: 'calcular_pedido',
          result: [
            {
              type: 'text',
              text: `El sistema ya le mandó al cliente este resumen y los botones del método de pago — no lo repitas:\n${resumen}\nCuando el cliente elija el método de pago, el sistema crea el pedido solo. Si escribe el método de pago en vez de tocar el botón, también lo toma el sistema.`,
            },
          ],
        },
      });
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        aviso.id,
      );
    } catch (err) {
      // El cliente ya tiene su resumen: si Gemini no responde, se guarda
      // la interacción previa y la conversación sigue igual.
      this.logger.warn(
        `id=${identificadorExterno} no se pudo avisar a Gemini del resumen: ${(err as Error).message}`,
      );
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        interaccionId,
      );
    }
  }

  private async enviarResumenPorTexto(
    ctx: ContextoHerramienta,
    calculo: Extract<ResultadoCalculo, { ok: true }>,
  ): Promise<string> {
    const resumen = `${
      armarResumenPedido({
        nombreCompleto: `${calculo.datos.nombre} ${calculo.datos.apellido}`,
        lineas: calculo.lineas,
        modalidad: calculo.datos.modalidad,
        direccion: calculo.datos.direccion ?? null,
        costoDomicilio: COSTO_DOMICILIO_DEFAULT,
        nota: calculo.datos.nota,
      }).texto
    }\n\n¿Cuál va a ser tu método de pago: *efectivo*, *transferencia* o *tarjeta*?`;
    await this.metaGraph.enviarMensajeSesion(
      ctx.canal,
      ctx.identificadorExterno,
      resumen,
    );
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      resumen,
    );
    return resumen;
  }
}
