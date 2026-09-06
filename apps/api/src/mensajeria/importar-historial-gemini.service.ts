import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversacionesService, type DireccionMensaje } from './conversaciones.service';

const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
// Cada interaction es UN solo intercambio (no la conversación completa) y
// encadena hacia atrás vía previous_interaction_id — hay que recorrer toda
// la cadena. Techo defensivo por si algún día apareciera un ciclo raro.
const MAX_SALTOS_CADENA = 200;

interface PasoInteraction {
  type: string;
  content?: { type: string; text?: string }[];
}

interface RespuestaInteraction {
  id: string;
  created?: string;
  updated?: string;
  previous_interaction_id?: string | null;
  steps?: PasoInteraction[];
}

export interface ResultadoImportacionConversacion {
  conversacionId: string;
  canal: string;
  identificadorExterno: string;
  mensajesImportados: number;
  pasosOmitidos: number;
  saltosCadena: number;
  omitida: 'ya_tenia_mensajes' | null;
  error: string | null;
}

/**
 * Migración de una sola vez: antes de que existiera `mensajes_conversacion`,
 * el único lugar donde quedaba el texto de una conversación era del lado de
 * Gemini (Interactions API), referenciado por `gemini_interaction_id`. Este
 * servicio trae ese historial hacia la base propia para las conversaciones
 * que todavía lo tienen — se borra apenas se usa una vez, no es una
 * funcionalidad permanente (ver admin.controller.ts).
 *
 * Cada interaction de Gemini representa UN solo intercambio (no la
 * conversación entera) y apunta a la anterior vía `previous_interaction_id`
 * — hay que recorrer toda la cadena hacia atrás hasta llegar a la primera
 * (confirmado a mano contra la API real: el `gemini_interaction_id` guardado
 * en `conversaciones_bot` es solo el último eslabón).
 */
@Injectable()
export class ImportarHistorialGeminiService {
  private readonly logger = new Logger(ImportarHistorialGeminiService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly conversaciones: ConversacionesService,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY');
  }

  async importarTodas(dryRun: boolean): Promise<ResultadoImportacionConversacion[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no configurada.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('id, canal, identificador_externo, gemini_interaction_id, ultima_interaccion')
      .not('gemini_interaction_id', 'is', null);
    if (error) throw error;

    const resultados: ResultadoImportacionConversacion[] = [];
    for (const fila of data ?? []) {
      try {
        resultados.push(await this.importarUna(fila, dryRun));
      } catch (err) {
        resultados.push({
          conversacionId: fila.id,
          canal: fila.canal,
          identificadorExterno: fila.identificador_externo,
          mensajesImportados: 0,
          pasosOmitidos: 0,
          saltosCadena: 0,
          omitida: null,
          error: (err as Error).message,
        });
        this.logger.error(
          `Falló importación de historial para conversación ${fila.id}: ${(err as Error).message}`,
        );
      }
    }
    return resultados;
  }

  private async obtenerInteraction(id: string): Promise<RespuestaInteraction> {
    const res = await fetch(`${GEMINI_INTERACTIONS_URL}/${id}`, {
      headers: { 'x-goog-api-key': this.apiKey as string },
    });
    if (!res.ok) {
      throw new Error(`Gemini respondió ${res.status} para ${id}`);
    }
    return (await res.json()) as RespuestaInteraction;
  }

  private async importarUna(
    fila: {
      id: string;
      canal: string;
      identificador_externo: string;
      gemini_interaction_id: string;
      ultima_interaccion: string;
    },
    dryRun: boolean,
  ): Promise<ResultadoImportacionConversacion> {
    const { count, error: countError } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', fila.id);
    if (countError) throw countError;

    if ((count ?? 0) > 0) {
      return {
        conversacionId: fila.id,
        canal: fila.canal,
        identificadorExterno: fila.identificador_externo,
        mensajesImportados: 0,
        pasosOmitidos: 0,
        saltosCadena: 0,
        omitida: 'ya_tenia_mensajes',
        error: null,
      };
    }

    // Se recorre la cadena hacia atrás (más nueva -> más vieja). Cada
    // eslabón visitado es más viejo que todo lo ya juntado, así que sus
    // mensajes se anteponen — pero el orden DENTRO de un mismo eslabón
    // (ej. user_input antes que model_output) se mantiene tal cual viene,
    // nunca se invierte.
    let mensajes: { direccion: DireccionMensaje; texto: string; timestamp: Date }[] = [];
    let pasosOmitidos = 0;
    let saltosCadena = 0;
    let cursor: string | null = fila.gemini_interaction_id;

    while (cursor && saltosCadena < MAX_SALTOS_CADENA) {
      const interaction = await this.obtenerInteraction(cursor);
      saltosCadena += 1;
      const timestamp = interaction.created
        ? new Date(interaction.created)
        : new Date(fila.ultima_interaccion);

      const mensajesDeEsteEslabon: { direccion: DireccionMensaje; texto: string; timestamp: Date }[] = [];
      for (const paso of interaction.steps ?? []) {
        const texto = (paso.content ?? [])
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('\n')
          .trim();

        let direccion: DireccionMensaje | null = null;
        if (paso.type === 'user_input') direccion = 'entrante';
        else if (paso.type === 'model_output') direccion = 'saliente_bot';

        if (!direccion || !texto) {
          pasosOmitidos += 1;
          continue;
        }
        mensajesDeEsteEslabon.push({ direccion, texto, timestamp });
      }
      mensajes = [...mensajesDeEsteEslabon, ...mensajes];

      cursor = interaction.previous_interaction_id ?? null;
    }

    if (!dryRun) {
      for (const mensaje of mensajes) {
        await this.conversaciones.registrarMensajeConTimestamp(
          fila.id,
          mensaje.direccion,
          mensaje.texto,
          mensaje.timestamp,
        );
      }
    }

    return {
      conversacionId: fila.id,
      canal: fila.canal,
      identificadorExterno: fila.identificador_externo,
      mensajesImportados: mensajes.length,
      pasosOmitidos,
      saltosCadena,
      omitida: null,
      error: null,
    };
  }
}
