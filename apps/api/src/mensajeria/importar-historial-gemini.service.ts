import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversacionesService, type DireccionMensaje } from './conversaciones.service';

const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

interface PasoInteraction {
  type: string;
  content?: { type: string; text?: string }[];
}

interface RespuestaInteraction {
  id: string;
  created?: string;
  updated?: string;
  steps?: PasoInteraction[];
}

export interface ResultadoImportacionConversacion {
  conversacionId: string;
  canal: string;
  identificadorExterno: string;
  mensajesImportados: number;
  pasosOmitidos: number;
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
        omitida: 'ya_tenia_mensajes',
        error: null,
      };
    }

    const res = await fetch(
      `${GEMINI_INTERACTIONS_URL}/${fila.gemini_interaction_id}`,
      { headers: { 'x-goog-api-key': this.apiKey as string } },
    );
    if (!res.ok) {
      throw new Error(`Gemini respondió ${res.status} para ${fila.gemini_interaction_id}`);
    }
    const interaction = (await res.json()) as RespuestaInteraction;
    const pasos = interaction.steps ?? [];

    const inicio = interaction.created ? new Date(interaction.created) : null;
    const fin = interaction.updated
      ? new Date(interaction.updated)
      : new Date(fila.ultima_interaccion);

    const mensajes: { direccion: DireccionMensaje; texto: string; timestamp: Date }[] = [];
    let pasosOmitidos = 0;
    pasos.forEach((paso, indice) => {
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
        return;
      }

      const proporcion = pasos.length > 1 ? indice / (pasos.length - 1) : 0;
      const timestamp =
        inicio && fin
          ? new Date(inicio.getTime() + (fin.getTime() - inicio.getTime()) * proporcion)
          : fin;
      mensajes.push({ direccion, texto, timestamp });
    });

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
      omitida: null,
      error: null,
    };
  }
}
