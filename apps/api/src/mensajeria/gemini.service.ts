import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogService,
  entraEnCatalogoMeta,
} from '../catalog/catalog.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { MetaGraphService } from './meta-graph.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion } from '../common/horario';
import {
  buscarProductoUnico,
  contieneNumeroNoVerificado,
  elegirVariante,
  palabrasSignificativas,
} from './busqueda-productos';
import { armarResumenPedido, type LineaPedido } from './resumen-pedido';
// Mensaje fijo para cerrar la conversación recién al derivar — antes el
// modelo componía su propio cierre y en producción llegó a decir "tu
// pedido ya quedó registrado" con un tiempo de entrega inventado.
import { AvisoEquipoService, MENSAJE_DERIVACION } from './aviso-equipo.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import {
  ConversacionesService,
  type CanalMensajeria,
  type ItemCarritoPendiente,
  type ModalidadPedido,
} from './conversaciones.service';

import {
  DIRECCION,
  ESTADO_ATENCION_TEXTO,
  HERRAMIENTAS,
  HORARIO,
  HORARIO_PEDIDOS_BOT,
  NOMBRE_NEGOCIO,
  SIN_TOTAL_INVENTADO,
  SYSTEM_INSTRUCTION,
  TAMANOS_PIZZA,
  URL_CATALOGO,
} from './gemini-prompt';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODELO_DEFAULT = 'gemini-flash-lite-latest';
const MAX_TURNOS_HERRAMIENTAS = 4;
// Medido en producción (oct 2026): un prompt mínimo tardó entre 5 y 28s
// con el mismo modelo. Con 20s se cortaban respuestas que igual llegaban;
// el webhook ya le respondió 200 a Meta, así que esperar más no tiene costo
// del lado de Meta — solo demora la respuesta al cliente.
const TIMEOUT_GEMINI_MS = 45_000;
// Un solo reintento ante corte o error transitorio (429/5xx): más de eso
// deja al cliente esperando minutos por una respuesta.
const REINTENTOS_GEMINI = 1;
const LIMITE_MENSAJES_VENTANA_MINUTOS = 60;
const LIMITE_MENSAJES_MAX = 40;
// WhatsApp rechaza mensajes de más de 4096 caracteres.
const MAX_LARGO_MENSAJE_WHATSAPP = 4096;

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

interface PasoFunctionCall {
  id: string;
  type: 'function_call';
  name: string;
  arguments: Record<string, unknown>;
}

interface PasoModelOutput {
  type: 'model_output';
  content: { type: string; text: string }[];
}

interface RespuestaInteraction {
  id: string;
  status: 'completed' | 'requires_action';
  // Opcional de verdad — un response real en producción llegó sin este
  // campo (API en beta), ver el uso con (respuesta.steps ?? []) abajo.
  steps?: (PasoFunctionCall | PasoModelOutput | { type: string })[];
  // No documentados de forma estable en esta API en beta — se loguean si
  // vienen, para poder correlacionar un cambio de comportamiento con un
  // alias de modelo o un consumo de tokens puntual, sin depender de que
  // existan (el pinning de modelo por alias es una decisión consciente,
  // ver README de mensajeria/).
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

type Producto = Awaited<ReturnType<CatalogService['getProductos']>>[number];

/**
 * Corte por timeout, 429, 5xx o un function call mal formado por el
 * modelo: vale la pena reintentar. Otro 4xx no.
 */
class ErrorTransitorioGemini extends ServiceUnavailableException {}

type ResultadoCalculo =
  | {
      ok: true;
      items: ItemCarritoPendiente[];
      lineas: LineaPedido[];
      datos: {
        modalidad: ModalidadPedido;
        direccion?: string;
        nombre: string;
        apellido: string;
      };
    }
  | { ok: false; texto: string };

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
  private readonly apiKey?: string;
  private readonly modelo: string;

  constructor(
    private readonly config: ConfigService,
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversionesMeta: ConversionesMetaService,
    private readonly avisoEquipo: AvisoEquipoService,
    private readonly checkout: CheckoutWhatsappService,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelo = this.config.get<string>('GEMINI_MODEL') || MODELO_DEFAULT;
    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY no configurada — el bot no puede responder.',
      );
    }
  }

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
    if (!this.apiKey) {
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
        canal,
        identificadorExterno,
        telefono,
        textoEntrante,
        conversacionId,
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

  private truncarParaWhatsapp(texto: string): string {
    if (texto.length <= MAX_LARGO_MENSAJE_WHATSAPP) return texto;
    return `${texto.slice(0, MAX_LARGO_MENSAJE_WHATSAPP - 1)}…`;
  }

  private async conversarConGemini(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    textoEntrante: string,
    conversacionId: string,
  ): Promise<string | null> {
    const interaccionPrevia =
      await this.conversaciones.obtenerUltimaInteraccionGemini(
        canal,
        identificadorExterno,
      );

    let respuesta = await this.llamarGemini({
      model: this.modelo,
      system_instruction: SYSTEM_INSTRUCTION,
      tools: HERRAMIENTAS,
      ...(interaccionPrevia
        ? { previous_interaction_id: interaccionPrevia, input: textoEntrante }
        : { input: textoEntrante }),
    });

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

      if (llamada.name === 'enviar_catalogo') {
        const enviado = await this.metaGraph.enviarCatalogo(
          canal,
          identificadorExterno,
          URL_CATALOGO,
          await this.retailerIdMiniatura(),
        );
        await this.conversaciones.registrarMensaje(
          conversacionId,
          'saliente_bot',
          enviado === 'catalogo'
            ? 'Menú enviado como catálogo de WhatsApp.'
            : `Mirá nuestro catálogo completo con fotos y precios acá: ${URL_CATALOGO}`,
        );
        await this.conversaciones.guardarInteraccionGemini(
          canal,
          identificadorExterno,
          respuesta.id,
        );
        return null;
      }

      if (llamada.name === 'mostrar_productos') {
        const consulta = String(llamada.arguments.consulta ?? '');
        const mostrados = await this.enviarProductos(
          canal,
          identificadorExterno,
          consulta,
        );
        if (mostrados.length > 0) {
          const textoProductos = `Productos mostrados: ${mostrados.join(', ')}`;
          await this.conversaciones.registrarMensaje(
            conversacionId,
            'saliente_bot',
            textoProductos,
          );
        }
        await this.conversaciones.guardarInteraccionGemini(
          canal,
          identificadorExterno,
          respuesta.id,
        );
        return null;
      }

      if (llamada.name === 'derivar_a_humano') derivadoEnEsteTurno = true;

      let resultado: string;
      if (llamada.name === 'calcular_pedido') {
        const calculo = await this.calcularPedido(
          llamada.arguments,
          canal,
          identificadorExterno,
        );
        if (calculo.ok) {
          await this.enviarResumenPedido(
            canal,
            identificadorExterno,
            conversacionId,
            calculo,
            respuesta.id,
            llamada.id,
          );
          return null;
        }
        resultado = calculo.texto;
      } else {
        resultado = await this.ejecutarHerramienta(
          llamada.name,
          llamada.arguments,
          canal,
          identificadorExterno,
          telefono,
          conversacionId,
        );
      }
      resultadosHerramientas.push(resultado);
      // Solo la primera línea: el resumen de calcular_pedido trae nombre y
      // dirección del cliente en las siguientes.
      this.logger.log(
        `id=${identificadorExterno} herramienta=${llamada.name} → ${resultado.split('\n')[0].slice(0, 160)}`,
      );

      respuesta = await this.llamarGemini({
        model: this.modelo,
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

    this.logger.log(
      `canal=${canal} id=${identificadorExterno} modelo=${respuesta.model ?? this.modelo}` +
        (respuesta.usage
          ? ` tokens_in=${respuesta.usage.input_tokens ?? '?'} tokens_out=${respuesta.usage.output_tokens ?? '?'}`
          : ''),
    );

    const salida = (respuesta.steps ?? []).find(
      (p): p is PasoModelOutput => p.type === 'model_output',
    );
    const texto = salida?.content[0]?.text;
    if (texto && contieneNumeroNoVerificado(texto, resultadosHerramientas)) {
      // Un número largo (cuenta, Nequi, teléfono) que ninguna herramienta
      // devolvió es un dato inventado: no se manda, y una persona sigue.
      this.logger.warn(
        `id=${identificadorExterno} respuesta bloqueada: número no verificado — se deriva a una persona.`,
      );
      await this.ejecutarHerramienta(
        'derivar_a_humano',
        {},
        canal,
        identificadorExterno,
        telefono,
        conversacionId,
      );
      return MENSAJE_DERIVACION;
    }
    return formatearParaWhatsapp(
      texto ??
        'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.',
    );
  }

  private async ejecutarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string | null,
    conversacionId: string,
  ): Promise<string> {
    try {
      switch (nombre) {
        case 'consultar_producto':
          return await this.textoProducto(
            String(argumentos.nombre_producto ?? ''),
          );
        case 'obtener_horario':
          return [
            `Horario del local: ${HORARIO}`,
            HORARIO_PEDIDOS_BOT,
            `Ahora mismo: ${ESTADO_ATENCION_TEXTO[estadoAtencion(new Date())]}`,
            `Dirección: ${DIRECCION}`,
            `Costo de domicilio: $${COSTO_DOMICILIO_DEFAULT.toLocaleString('es-CO')}`,
          ].join('\n');
        case 'obtener_categorias':
          return await this.textoCategorias();
        case 'obtener_tamanos_pizza':
          return TAMANOS_PIZZA;
        case 'consultar_pedido':
          return await this.textoPedido(telefono);
        case 'obtener_cliente_registrado': {
          if (!telefono)
            return 'No se pudo identificar el número de teléfono del cliente en este canal.';
          const nombre = await this.pedidos.buscarNombrePorTelefono(telefono);
          return nombre
            ? `Cliente encontrado: ${nombre}.`
            : 'No se encontró ningún cliente registrado con este número de teléfono.';
        }
        case 'derivar_a_humano':
          await this.conversaciones.derivarAHumano(canal, identificadorExterno);
          this.avisoEquipo.notificar({
            canal,
            identificadorExterno,
            telefono,
            conversacionId,
          });
          this.conversionesMeta.avisarLead(canal, identificadorExterno);
          return `Conversación derivada. Respondé al cliente con este mensaje EXACTO, sin cambiarlo ni agregar nada de "confirmado" o tiempos de entrega: "${MENSAJE_DERIVACION}"`;
        default:
          // En producción el modelo pidió herramientas que no existen
          // (obtener_sabores_pizza, obtener_menu_completo): se le devuelve
          // la lista real para que se corrija en la vuelta siguiente.
          return `La herramienta "${nombre}" no existe. Las únicas disponibles son: ${HERRAMIENTAS.map((h) => h.name).join(', ')}.`;
      }
    } catch (err) {
      this.logger.error(
        `Error ejecutando herramienta ${nombre}: ${(err as Error).message}`,
      );
      return 'No se pudo obtener esta información en este momento.';
    }
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

    const elegidos = this.elegirProductos(productos, categorias, consulta);
    const tarjetas = elegidos.slice(0, 3).map((p) => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagen_url,
      precioDesde: Math.min(
        ...p.variantes.map((v) => v.precio_oferta ?? v.precio),
      ),
    }));

    const enCatalogo = elegidos.filter(entraEnCatalogoMeta);
    const secciones = categorias
      .map((c) => ({
        titulo: c.nombre,
        productos: enCatalogo.filter((p) => p.categoria_id === c.id),
      }))
      .filter((s) => s.productos.length > 0);

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
   * Orden de prioridad: un producto nombrado ("pizza hawaiana personal")
   * gana sobre su categoría; después la categoría ("pizzas", "bebidas");
   * después palabras de la descripción; y si nada matchea, todo el menú.
   */
  private elegirProductos(
    productos: Producto[],
    categorias: { id: string; nombre: string }[],
    consulta: string,
  ): Producto[] {
    const buscadas = palabrasSignificativas(consulta);
    const puntuar = (texto: (p: Producto) => string) =>
      productos
        .map((p) => ({
          producto: p,
          puntaje: palabrasSignificativas(texto(p)).filter((w) =>
            buscadas.includes(w),
          ).length,
        }))
        .filter((r) => r.puntaje > 0)
        .sort((a, b) => b.puntaje - a.puntaje)
        .map((r) => r.producto);

    const porNombre = puntuar((p) => p.nombre);
    if (porNombre.length > 0) return porNombre;

    // Raíz de 5 letras: "pizzas" → "pizza", "bebida" → "bebid". "pizza"
    // está entre las palabras ignoradas de arriba, por eso la categoría se
    // compara aparte.
    const raiz = (palabra: string) =>
      palabra.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 5);
    const raicesConsulta = consulta
      .split(/[^\p{L}0-9]+/u)
      .filter((w) => w.length > 3)
      .map(raiz);
    const categoriasPedidas = new Set(
      categorias
        .filter((c) => raicesConsulta.includes(raiz(c.nombre)))
        .map((c) => c.id),
    );
    if (categoriasPedidas.size > 0) {
      return productos.filter((p) => categoriasPedidas.has(p.categoria_id));
    }

    const porDescripcion = puntuar((p) => `${p.nombre} ${p.descripcion ?? ''}`);
    return porDescripcion.length > 0 ? porDescripcion : productos;
  }

  private async textoCategorias(): Promise<string> {
    const categorias = await this.catalog.getCategorias();
    if (categorias.length === 0) {
      return 'No se pudo obtener la lista de categorías en este momento.';
    }
    const nombres = categorias.map((c) => c.nombre).join(', ');
    return `Vendemos: ${nombres}.`;
  }

  private async textoProducto(nombreBuscado: string): Promise<string> {
    const productos = await this.catalog.getProductos();
    const { encontrado, error } = buscarProductoUnico(nombreBuscado, productos);
    if (error)
      return `${error} Si no se puede resolver, ofrecé mandarle el menú completo con enviar_catalogo.`;
    const variantes = encontrado!.variantes
      .map(
        (v) =>
          `${v.nombre}: $${(v.precio_oferta ?? v.precio).toLocaleString('es-CO')}`,
      )
      .join(', ');
    return `${encontrado!.nombre}${encontrado!.descripcion ? ` — ${encontrado!.descripcion}` : ''}. Precios: ${variantes}`;
  }

  /**
   * Total real del pedido. Los productos del carrito del catálogo salen
   * por id exacto de variante (guardado al recibir el carrito), sin que el
   * modelo los vuelva a nombrar; solo lo pedido aparte por escrito pasa por
   * la búsqueda por nombre. Si algo falla, devuelve el texto para el modelo
   * — nunca un total.
   */
  private async calcularPedido(
    argumentos: Record<string, unknown>,
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<ResultadoCalculo> {
    const items = Array.isArray(argumentos.items)
      ? (argumentos.items as Record<string, unknown>[])
      : [];
    const nombre = String(argumentos.nombre ?? '').trim();
    const apellido = String(argumentos.apellido ?? '').trim();
    const modalidad = String(argumentos.modalidad ?? '').toLowerCase();
    const direccion = argumentos.direccion
      ? String(argumentos.direccion)
      : null;
    const fallo = (texto: string): ResultadoCalculo => {
      // Producto y tamaño pedidos, nunca datos del cliente.
      this.logger.warn(
        `id=${identificadorExterno} calcular_pedido falló — items=${JSON.stringify(items.map((i) => [i.producto, i.tamano, i.cantidad]))} → ${texto.slice(0, 160)}`,
      );
      return { ok: false, texto };
    };

    // Guardrail real, no solo la instrucción del prompt — si Gemini intenta
    // calcular sin nombre completo, esta herramienta se niega y lo manda a
    // preguntar, en vez de confiar en que el modelo siempre respete el
    // "required" del schema.
    if (!nombre || !apellido) {
      return fallo(
        'Todavía falta el nombre completo (nombre y apellido) de quien hace el pedido — preguntáselo al cliente antes de calcular el total.',
      );
    }
    if (!['domicilio', 'retiro', 'local'].includes(modalidad)) {
      return fallo(
        `Falta la modalidad: preguntale al cliente si es para domicilio, para retirar o para comer en el local. ${SIN_TOTAL_INVENTADO}`,
      );
    }
    if (modalidad === 'domicilio' && !direccion?.trim()) {
      return fallo(
        `Falta la dirección de entrega: preguntásela al cliente. ${SIN_TOTAL_INVENTADO}`,
      );
    }

    const carrito = await this.conversaciones.obtenerCarrito(
      canal,
      identificadorExterno,
    );
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
    const lineas: LineaPedido[] = disponibles.map((i) => ({
      cantidad: i.cantidad,
      productoNombre: i.productoNombre,
      varianteNombre: i.conTamanos ? i.varianteNombre : null,
      precioUnitario: i.precio,
    }));
    // Ids exactos de todo lo que entra al pedido: el checkout con botones
    // crea el pedido con estos, sin volver a buscar por nombre.
    const itemsPedido = disponibles.map((i) => ({
      varianteId: i.varianteId,
      cantidad: i.cantidad,
    }));

    const productos = items.length > 0 ? await this.catalog.getProductos() : [];
    for (const item of items) {
      const nombreProducto = String(item.producto ?? '');
      const cantidadCruda = Math.round(Number(item.cantidad ?? 1)) || 1;
      const cantidad = Math.min(Math.max(cantidadCruda, 1), 20);
      const tamanoBuscado = item.tamano ? String(item.tamano) : null;

      const {
        encontrado,
        variante: varianteNombrada,
        error,
      } = buscarProductoUnico(nombreProducto, productos);
      if (error) {
        return fallo(
          `No se pudo calcular el pedido: ${error} ${SIN_TOTAL_INVENTADO}`,
        );
      }

      const variante =
        varianteNombrada ?? elegirVariante(encontrado!, tamanoBuscado);
      if (!variante) {
        const opciones = encontrado!.variantes.map((v) => v.nombre).join(', ');
        return fallo(
          `Para "${encontrado!.nombre}" falta saber cuál — opciones exactas: ${opciones}. Preguntale al cliente cuál quiere, ofreciendo solo esas opciones. ${SIN_TOTAL_INVENTADO}`,
        );
      }
      lineas.push({
        cantidad,
        productoNombre: encontrado!.nombre,
        varianteNombre:
          encontrado!.variantes.length > 1 ? variante.nombre : null,
        precioUnitario: variante.precio_oferta ?? variante.precio,
      });
      itemsPedido.push({ varianteId: variante.id, cantidad });
    }

    if (lineas.length === 0) {
      return fallo(
        `No hay productos para calcular: el cliente no mandó un carrito del catálogo ni pidió productos por escrito. Preguntale qué quiere pedir. ${SIN_TOTAL_INVENTADO}`,
      );
    }

    return {
      ok: true,
      items: itemsPedido,
      lineas,
      datos: {
        modalidad: modalidad as ModalidadPedido,
        direccion: direccion?.trim() || undefined,
        nombre,
        apellido,
      },
    };
  }

  /**
   * Manda el resumen armado por código y le avisa a Gemini que ya se envió.
   * En WhatsApp pasa al checkout con botones (paso de pago): el pedido se
   * crea con un toque, sin que el modelo intervenga. En Messenger/Instagram
   * se pregunta el pago por texto. Lo que Gemini conteste al aviso no se
   * manda al cliente.
   */
  private async enviarResumenPedido(
    canal: CanalMensajeria,
    identificadorExterno: string,
    conversacionId: string,
    calculo: Extract<ResultadoCalculo, { ok: true }>,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    let resumen: string;
    if (canal === 'whatsapp') {
      resumen = await this.checkout.ofrecerPagoDesdeCalculo({
        identificadorExterno,
        conversacionId,
        items: calculo.items,
        checkout: { paso: 'pago', ...calculo.datos },
      });
    } else {
      resumen = `${
        armarResumenPedido({
          nombreCompleto: `${calculo.datos.nombre} ${calculo.datos.apellido}`,
          lineas: calculo.lineas,
          modalidad: calculo.datos.modalidad,
          direccion: calculo.datos.direccion ?? null,
          costoDomicilio: COSTO_DOMICILIO_DEFAULT,
        }).texto
      }\n\n¿Cuál va a ser tu método de pago: *efectivo*, *transferencia* o *tarjeta*?`;
      await this.metaGraph.enviarMensajeSesion(
        canal,
        identificadorExterno,
        resumen,
      );
      await this.conversaciones.registrarMensaje(
        conversacionId,
        'saliente_bot',
        resumen,
      );
    }
    this.logger.log(
      `id=${identificadorExterno} herramienta=calcular_pedido → resumen enviado por el sistema`,
    );
    const calculoEnviado = { resumen };
    try {
      const aviso = await this.llamarGemini({
        model: this.modelo,
        previous_interaction_id: interaccionId,
        input: {
          type: 'function_result',
          call_id: llamadaId,
          name: 'calcular_pedido',
          result: [
            {
              type: 'text',
              text: `El sistema ya le mandó al cliente este resumen y los botones del método de pago — no lo repitas:\n${calculoEnviado.resumen}\nCuando el cliente elija el método de pago, el sistema crea el pedido solo. Si escribe el método de pago en vez de tocar el botón, también lo toma el sistema.`,
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

  private async textoPedido(telefono: string | null): Promise<string> {
    if (!telefono) {
      return 'No se pudo identificar el número de teléfono del cliente en este canal.';
    }
    const pedidos = await this.pedidos.buscarPorTelefono(telefono);
    if (pedidos.length === 0) {
      return 'No se encontraron pedidos asociados a este número de teléfono.';
    }
    const ultimo = pedidos[0];
    const items = ultimo.items
      .map(
        (i) =>
          `${i.cantidad}x ${i.producto_nombre}${i.variante_nombre ? ` (${i.variante_nombre})` : ''}`,
      )
      .join(', ');
    return `Último pedido — estado: ${ultimo.estado}. Items: ${items}. Total: $${ultimo.total.toLocaleString('es-CO')}`;
  }

  /**
   * Nota de voz → texto, con la API generateContent (audio inline). Solo
   * transcribe: el texto después sigue el mismo flujo que un mensaje
   * escrito. null si no hay voz entendible o si el formato no es soportado
   * (WhatsApp manda OGG/Opus; Gemini documenta OGG Vorbis).
   */
  async transcribirAudio(datos: Buffer, mime: string): Promise<string | null> {
    if (!this.apiKey) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_GEMINI_MS);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelo}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Transcribí literalmente esta nota de voz en español de Colombia. Devolvé solo el texto dicho, sin comillas ni comentarios. Si no hay voz entendible, devolvé exactamente: (sin voz)',
                  },
                  {
                    inline_data: {
                      mime_type: mime.split(';')[0],
                      data: datos.toString('base64'),
                    },
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        const detalle = await res.text();
        this.logger.warn(
          `No se pudo transcribir el audio: ${res.status} ${detalle.slice(0, 200)}`,
        );
        return null;
      }
      const cuerpo = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const texto = (cuerpo.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join(' ')
        .trim();
      return texto && texto !== '(sin voz)' ? texto : null;
    } catch (err) {
      this.logger.warn(
        `No se pudo transcribir el audio: ${(err as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async llamarGemini(
    body: Record<string, unknown>,
  ): Promise<RespuestaInteraction> {
    for (let intento = 0; ; intento++) {
      try {
        return await this.llamarGeminiUnaVez(body);
      } catch (err) {
        if (
          !(err instanceof ErrorTransitorioGemini) ||
          intento >= REINTENTOS_GEMINI
        ) {
          throw err;
        }
        this.logger.warn(`${err.message} — reintentando una vez.`);
      }
    }
  }

  private async llamarGeminiUnaVez(
    body: Record<string, unknown>,
  ): Promise<RespuestaInteraction> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_GEMINI_MS);
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detalle = await res.text();
        const mensaje = `Gemini respondió ${res.status}: ${detalle}`;
        // malformed_tool_call: el modelo generó un JSON inválido para la
        // herramienta (visto en producción); Google indica reintentar.
        if (
          res.status === 429 ||
          res.status >= 500 ||
          detalle.includes('malformed_tool_call')
        ) {
          throw new ErrorTransitorioGemini(mensaje);
        }
        throw new ServiceUnavailableException(mensaje);
      }
      return await res.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ErrorTransitorioGemini(
          `Gemini no respondió en ${TIMEOUT_GEMINI_MS / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
