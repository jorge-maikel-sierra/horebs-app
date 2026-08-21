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
  mensajeId: string | null; // wamid (WhatsApp) o mid (Messenger/Instagram) — para deduplicar reenvíos de Meta
}

/**
 * Solo los campos que este servicio realmente lee de cada payload — así un
 * cambio de forma en la API de Meta lo marca el compilador en vez de
 * romperse en silencio en runtime.
 */
interface MetaReferral {
  source_id?: string;
  source_type?: string;
  ctwa_clid?: string;
  source?: string;
  ad_id?: string;
}

interface WhatsappMensaje {
  type: string;
  from: string;
  id?: string;
  text?: { body?: string };
  referral?: MetaReferral;
}

interface WhatsappWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: WhatsappMensaje[];
      };
    }[];
  }[];
}

interface MessengerEvento {
  sender?: { id?: string };
  message?: {
    text?: string;
    is_echo?: boolean;
    mid?: string;
    referral?: MetaReferral;
  };
  referral?: MetaReferral;
  postback?: { referral?: MetaReferral };
}

interface MessengerWebhookPayload {
  entry?: {
    messaging?: MessengerEvento[];
  }[];
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

  procesarWhatsapp(payload: WhatsappWebhookPayload): void {
    this.procesar(this.parsearWhatsapp(payload));
  }

  procesarMessenger(payload: MessengerWebhookPayload): void {
    this.procesar(this.parsearMessengerOInstagram(payload, 'messenger'));
  }

  procesarInstagram(payload: MessengerWebhookPayload): void {
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
    if (evento.mensajeId) {
      let duplicado = false;
      try {
        duplicado = await this.conversaciones.yaProcesado(evento.canal, evento.mensajeId);
      } catch (err) {
        // Si la verificación de duplicado en sí falla (no el chequeo, sino
        // el acceso a la tabla), se prefiere procesar el mensaje de más en
        // un caso raro antes que perder un mensaje real del cliente.
        this.logger.error(
          `No se pudo verificar duplicado del mensaje ${evento.mensajeId} — se procesa igual: ${(err as Error).message}`,
        );
      }
      if (duplicado) {
        this.logger.log(
          `Mensaje ${evento.mensajeId} ya procesado (reenvío de Meta) — se ignora.`,
        );
        return;
      }
    }

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
    // null = la herramienta (ej. el botón de catálogo) ya mandó el mensaje.
    if (respuesta === null) return;
    await this.metaGraph.enviarMensajeSesion(
      evento.canal,
      evento.identificadorExterno,
      respuesta,
    );
  }

  private parsearWhatsapp(payload: WhatsappWebhookPayload): EventoEntrante[] {
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
            mensajeId: mensaje.id ?? null,
          });
        }
      }
    }
    return eventos;
  }

  private extraerProcedenciaWhatsapp(mensaje: WhatsappMensaje): ProcedenciaAnuncio | null {
    const referral = mensaje.referral;
    if (!referral) return null;
    return {
      esAnuncio: true,
      anuncioId: referral.source_id ?? referral.ctwa_clid,
      fuente: referral.source_type ?? 'ad',
    };
  }

  private parsearMessengerOInstagram(
    payload: MessengerWebhookPayload,
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
          mensajeId: evento.message?.mid ?? null,
        });
      }
    }
    return eventos;
  }

  private extraerProcedenciaMessenger(evento: MessengerEvento): ProcedenciaAnuncio | null {
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
