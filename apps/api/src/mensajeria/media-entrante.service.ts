import { Injectable, Logger } from '@nestjs/common';
import {
  ComprobantesService,
  type ProcesarComprobanteInput,
} from './comprobantes.service';
import { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import { GeminiService } from './gemini.service';
import { MetaGraphService } from './meta-graph.service';
import type { EventoEntrante } from './parseo-webhook';

// Respuesta fija cuando llega algo que el bot no sabe leer.
export const MENSAJE_SOLO_TEXTO =
  'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me lo escribes?';
export const MENSAJE_AUDIO_NO_ENTENDIDO =
  'No pude escuchar bien tu audio 🙏 ¿Me lo escribes?';

/** Lo que llega como archivo: notas de voz, fotos y documentos de WhatsApp. */
@Injectable()
export class MediaEntranteService {
  private readonly logger = new Logger(MediaEntranteService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  /**
   * Nota de voz: se transcribe y sigue como si el cliente lo hubiera
   * escrito. Devuelve el texto para el historial, que queda con 🎤 para que
   * el equipo sepa que fue un audio.
   */
  async transcribirNota(evento: EventoEntrante): Promise<string> {
    if (evento.media?.tipo !== 'audio') {
      return evento.texto;
    }
    const transcripcion = await this.transcribir(evento.media.id);
    if (!transcripcion) return evento.texto;
    evento.texto = transcripcion;
    evento.media = undefined;
    return `🎤 ${transcripcion}`;
  }

  /**
   * Foto o PDF: si el cliente tiene un pedido esperando el comprobante de
   * transferencia, se guarda ahí — aunque la conversación esté derivada.
   * Devuelve true si el evento ya quedó atendido (no sigue al bot).
   */
  async atenderArchivo(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
  ): Promise<boolean> {
    const { media, mensajeId } = evento;
    if (!media || !mensajeId) return false;

    const esAudio = media.tipo === 'audio';
    const puedeSerComprobante =
      media.tipo === 'imagen' || media.tipo === 'documento';
    if (
      puedeSerComprobante &&
      (await this.guardarComprobante({
        canal: evento.canal,
        identificadorExterno: evento.identificadorExterno,
        telefono: evento.telefono ?? conversacion.telefono ?? null,
        conversacionId: conversacion.id,
        mensajeId,
        mediaId: media.id,
      }))
    ) {
      return true;
    }
    if (conversacion.estado === 'derivado') return true;

    const respuesta = esAudio ? MENSAJE_AUDIO_NO_ENTENDIDO : MENSAJE_SOLO_TEXTO;
    await this.metaGraph.enviarMensajeSesion(
      evento.canal,
      evento.identificadorExterno,
      respuesta,
    );
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'saliente_bot',
      respuesta,
    );
    return true;
  }

  private async guardarComprobante(
    datos: ProcesarComprobanteInput,
  ): Promise<boolean> {
    try {
      return await this.comprobantes.procesar(datos);
    } catch (err) {
      this.logger.error(
        `No se pudo procesar el archivo de ${datos.identificadorExterno}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async transcribir(mediaId: string): Promise<string | null> {
    try {
      const audio = await this.metaGraph.descargarMedia(mediaId);
      return await this.gemini.transcribirAudio(audio.datos, audio.mime);
    } catch (err) {
      this.logger.warn(
        `No se pudo descargar el audio ${mediaId}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
