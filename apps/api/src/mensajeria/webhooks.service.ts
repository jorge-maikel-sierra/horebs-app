import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { GeminiService } from './gemini.service';
import { MetaGraphService } from './meta-graph.service';
import { ConversacionesService, type CanalMensajeria } from './conversaciones.service';

export interface ProcedenciaAnuncio {
  esAnuncio: boolean;
  anuncioId?: string;
  fuente?: string;
}

export interface EventoEntrante {
  canal: CanalMensajeria;
  identificadorExterno: string; // wa_id de WhatsApp, o PSID/IGSID de Messenger/Instagram
  telefono: string | null; // solo WhatsApp expone el teléfono real
  texto: string;
  procedenciaAnuncio: ProcedenciaAnuncio | null;
}

/**
 * Verifica la firma, parsea el payload (WhatsApp vs Messenger/Instagram
 * tienen forma distinta), detecta si la conversación viene de un clic en
 * anuncio, y orquesta la respuesta — todo llamado sin `await` desde el
 * controller (mismo patrón fire-and-forget que MailService) para poder
 * responder 200 a Meta de inmediato.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
  ) {}

  verificarFirma(
    appSecret: string,
    rawBody: Buffer,
    firmaHeader: string | undefined,
  ): boolean {
    if (!firmaHeader?.startsWith('sha256=')) return false;

    const firmaRecibida = Buffer.from(firmaHeader.slice('sha256='.length), 'hex');
    const firmaCalculada = Buffer.from(
      createHmac('sha256', appSecret).update(rawBody).digest('hex'),
      'hex',
    );
    if (firmaRecibida.length !== firmaCalculada.length) return false;
    return timingSafeEqual(firmaRecibida, firmaCalculada);
  }

  procesarWhatsapp(payload: any): void {
    this.procesar(this.parsearWhatsapp(payload));
  }

  procesarMessenger(payload: any): void {
    this.procesar(this.parsearMessengerOInstagram(payload, 'messenger'));
  }

  procesarInstagram(payload: any): void {
    this.procesar(this.parsearMessengerOInstagram(payload, 'instagram'));
  }

  private procesar(eventos: EventoEntrante[]): void {
    for (const evento of eventos) {
      this.manejarEvento(evento).catch((err) => {
        this.logger.error(
          `Error procesando mensaje de ${evento.canal} (${evento.identificadorExterno}): ${(err as Error).message}`,
        );
      });
    }
  }

  private async manejarEvento(evento: EventoEntrante): Promise<void> {
    if (evento.procedenciaAnuncio?.esAnuncio) {
      this.logger.log(
        `Conversación desde anuncio — canal=${evento.canal} id=${evento.identificadorExterno} anuncio_id=${evento.procedenciaAnuncio.anuncioId ?? 'desconocido'} fuente=${evento.procedenciaAnuncio.fuente ?? 'desconocida'}`,
      );
    }

    await this.conversaciones.registrarInteraccion(evento.canal, evento.identificadorExterno);
    const estado = await this.conversaciones.obtenerEstado(
      evento.canal,
      evento.identificadorExterno,
    );
    if (estado === 'derivado') {
      this.logger.log(
        `Conversación ya derivada a humano, no se auto-responde — canal=${evento.canal} id=${evento.identificadorExterno}`,
      );
      return;
    }

    const respuesta = await this.gemini.responder(
      evento.canal,
      evento.identificadorExterno,
      evento.telefono,
      evento.texto,
    );
    await this.metaGraph.enviarMensajeSesion(
      evento.canal,
      evento.identificadorExterno,
      respuesta,
    );
  }

  private parsearWhatsapp(payload: any): EventoEntrante[] {
    const eventos: EventoEntrante[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const mensaje of change?.value?.messages ?? []) {
          // MVP: solo texto — audio/imagen/ubicación quedan para una
          // extensión posterior, no se pidieron en el flujo básico.
          if (mensaje.type !== 'text') continue;
          eventos.push({
            canal: 'whatsapp',
            identificadorExterno: mensaje.from,
            telefono: mensaje.from,
            texto: mensaje.text?.body ?? '',
            procedenciaAnuncio: this.extraerProcedenciaWhatsapp(mensaje),
          });
        }
      }
    }
    return eventos;
  }

  private extraerProcedenciaWhatsapp(mensaje: any): ProcedenciaAnuncio | null {
    const referral = mensaje.referral;
    if (!referral) return null;
    return {
      esAnuncio: true,
      anuncioId: referral.source_id ?? referral.ctwa_clid,
      fuente: referral.source_type ?? 'ad',
    };
  }

  private parsearMessengerOInstagram(
    payload: any,
    canal: 'messenger' | 'instagram',
  ): EventoEntrante[] {
    const eventos: EventoEntrante[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const evento of entry?.messaging ?? []) {
        const texto = evento?.message?.text;
        const senderId = evento?.sender?.id;
        // Ignora deliveries/reads/postbacks sin texto y ecos de mensajes
        // que el bot mismo mandó (is_echo).
        if (!texto || !senderId || evento?.message?.is_echo) continue;
        eventos.push({
          canal,
          identificadorExterno: senderId,
          telefono: null, // Messenger/Instagram no exponen el teléfono real
          texto,
          procedenciaAnuncio: this.extraerProcedenciaMessenger(evento),
        });
      }
    }
    return eventos;
  }

  private extraerProcedenciaMessenger(evento: any): ProcedenciaAnuncio | null {
    const referral =
      evento.referral ?? evento.message?.referral ?? evento.postback?.referral;
    if (!referral) return null;
    return {
      esAnuncio: referral.source === 'ADS' || !!referral.ad_id,
      anuncioId: referral.ad_id,
      fuente: referral.source,
    };
  }
}
