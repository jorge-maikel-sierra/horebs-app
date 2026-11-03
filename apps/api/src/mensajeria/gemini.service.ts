import { Injectable, Logger } from '@nestjs/common';
import { MENSAJE_DERIVACION } from './aviso-equipo.service';
import { contieneNumeroNoVerificado } from './busqueda-productos';
import { ConversacionesService } from './conversaciones.service';
import type { CanalMensajeria } from './conversaciones.tipos';
import { DespachoHerramientasService } from './despacho-herramientas.service';
import { EnvioHerramientasService } from './envio-herramientas.service';
import {
  GeminiClienteService,
  type PasoFunctionCall,
  type PasoModelOutput,
  type RespuestaInteraction,
} from './gemini-cliente.service';
import { HERRAMIENTAS, armarSystemInstruction } from './gemini-prompt';
import type { ContextoHerramienta } from './herramientas-bot.tipos';

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

function formatearParaSocial(texto: string): string {
  return texto.replace(/^[ \t]*\*[ \t]+/gm, '- ').replace(/\*+(.+?)\*+/g, '$1');
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
    private readonly conversaciones: ConversacionesService,
    private readonly envios: EnvioHerramientasService,
    private readonly despacho: DespachoHerramientasService,
  ) {}

  /**
   * Devuelve `null` cuando la herramienta ya mandó el mensaje ella misma
   * (el botón de catálogo) — en ese caso no hay que enviar nada más.
   */
  async responder(
    ctx: ContextoHerramienta,
    textoEntrante: string,
  ): Promise<string | null> {
    const { canal, identificadorExterno } = ctx;
    if (!this.cliente.configurado) {
      return canal === 'whatsapp'
        ? 'En este momento no puedo responder automáticamente — escribí *humano* para que te atienda alguien del equipo.'
        : 'En este momento no puedo responder automáticamente — escribí "humano" para que te atienda alguien del equipo.';
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
        const avisoLimite =
          canal === 'whatsapp'
            ? 'Estás mandando muchos mensajes seguidos — dame un momento o escribí *humano* para que te atienda alguien del equipo.'
            : 'Estás mandando muchos mensajes seguidos — dame un momento o escribí "humano" para que te atienda alguien del equipo.';
        return this.truncarParaWhatsapp(avisoLimite);
      }

      const respuestaFinal = await this.conversarConGemini(ctx, textoEntrante);
      return respuestaFinal === null
        ? null
        : this.truncarParaWhatsapp(respuestaFinal);
    } catch (err) {
      this.logger.error(
        `Error respondiendo a canal=${canal} id=${identificadorExterno}: ${(err as Error).message}`,
      );
      return canal === 'whatsapp'
        ? 'Perdón, tuve un problema para procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.'
        : 'Perdón, tuve un problema para procesar tu mensaje. Escribí "humano" para hablar con alguien del equipo.';
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
      if (await this.envios.mandoElMensaje(llamada, ctx, respuesta.id)) {
        return null;
      }

      if (llamada.name === 'derivar_a_humano') derivadoEnEsteTurno = true;
      const resultado = await this.despacho.resultado(
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
    const esInicio = !interaccionPrevia;
    return this.cliente.llamar({
      model: this.cliente.modelo,
      system_instruction: armarSystemInstruction(ctx.canal, esInicio),
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
      await this.despacho.derivar(ctx);
      return MENSAJE_DERIVACION;
    }
    const textoBruto =
      texto ??
      (ctx.canal === 'whatsapp'
        ? 'Perdón, no pude procesar tu mensaje. Escribí *humano* para hablar con alguien del equipo.'
        : 'Perdón, no pude procesar tu mensaje. Escribí "humano" para hablar con alguien del equipo.');

    return ctx.canal === 'whatsapp'
      ? formatearParaWhatsapp(textoBruto)
      : formatearParaSocial(textoBruto);
  }
}
