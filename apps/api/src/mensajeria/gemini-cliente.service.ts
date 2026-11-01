import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODELOS_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_DEFAULT = 'gemini-flash-lite-latest';
// Medido en producción (oct 2026): un prompt mínimo tardó entre 5 y 28s
// con el mismo modelo. Con 20s se cortaban respuestas que igual llegaban;
// el webhook ya le respondió 200 a Meta, así que esperar más no tiene costo
// del lado de Meta — solo demora la respuesta al cliente.
const TIMEOUT_GEMINI_MS = 45_000;
const MS_POR_SEGUNDO = 1000;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_ERROR_SERVIDOR = 500;
// Un solo reintento ante corte o error transitorio (429/5xx): más de eso
// deja al cliente esperando minutos por una respuesta.
const REINTENTOS_GEMINI = 1;
const MAX_DETALLE_LOG = 200;

export interface PasoFunctionCall {
  id: string;
  type: 'function_call';
  name: string;
  arguments: Record<string, unknown>;
}

export interface PasoModelOutput {
  type: 'model_output';
  content: { type: string; text: string }[];
}

export interface RespuestaInteraction {
  id: string;
  status: 'completed' | 'requires_action';
  // Opcional de verdad — un response real en producción llegó sin este
  // campo (API en beta), ver el uso con (respuesta.steps ?? []).
  steps?: (PasoFunctionCall | PasoModelOutput | { type: string })[];
  // No documentados de forma estable en esta API en beta — se loguean si
  // vienen, para poder correlacionar un cambio de comportamiento con un
  // alias de modelo o un consumo de tokens puntual, sin depender de que
  // existan (el pinning de modelo por alias es una decisión consciente,
  // ver README de mensajeria/).
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Corte por timeout, 429, 5xx o un function call mal formado por el
 * modelo: vale la pena reintentar. Otro 4xx no.
 */
class ErrorTransitorioGemini extends ServiceUnavailableException {}

function cuerpoTranscripcion(datos: Buffer, mime: string): unknown {
  return {
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
  };
}

/** Transporte hacia la Interactions API de Gemini: timeout, reintento y transcripción de audio. */
@Injectable()
export class GeminiClienteService {
  private readonly logger = new Logger(GeminiClienteService.name);
  private readonly apiKey?: string;
  readonly modelo: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelo = this.config.get<string>('GEMINI_MODEL') || MODELO_DEFAULT;
    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY no configurada — el bot no puede responder.',
      );
    }
  }

  get configurado(): boolean {
    return !!this.apiKey;
  }

  async llamar(body: Record<string, unknown>): Promise<RespuestaInteraction> {
    for (let intento = 0; ; intento++) {
      try {
        return await this.llamarUnaVez(body);
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
        `${GEMINI_MODELOS_URL}/${this.modelo}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cuerpoTranscripcion(datos, mime)),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        const detalle = await res.text();
        this.logger.warn(
          `No se pudo transcribir el audio: ${res.status} ${detalle.slice(0, MAX_DETALLE_LOG)}`,
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

  private async llamarUnaVez(
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
          res.status === STATUS_TOO_MANY_REQUESTS ||
          res.status >= STATUS_ERROR_SERVIDOR ||
          detalle.includes('malformed_tool_call')
        ) {
          throw new ErrorTransitorioGemini(mensaje);
        }
        throw new ServiceUnavailableException(mensaje);
      }
      return (await res.json()) as RespuestaInteraction;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ErrorTransitorioGemini(
          `Gemini no respondió en ${TIMEOUT_GEMINI_MS / MS_POR_SEGUNDO}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
