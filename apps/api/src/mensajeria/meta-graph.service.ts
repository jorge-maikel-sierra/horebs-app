import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CanalMensajeria } from './conversaciones.service';

const REINTENTOS = 2;
const BACKOFF_MS = [500, 1500];

/**
 * Envío saliente por Graph API — solo mensajes de sesión (gratis dentro de
 * la ventana de 24h/72h). A propósito NO hay ningún método para enviar
 * plantillas: así el flujo automático nunca puede disparar un cobro por su
 * cuenta. Mandar una plantilla de remarketing es una acción manual aparte,
 * a construir si se pide explícitamente.
 */
@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);
  private readonly version: string;
  private readonly whatsappToken?: string;
  private readonly whatsappPhoneNumberId?: string;
  private readonly pageToken?: string;
  private readonly pageId?: string;

  constructor(private readonly config: ConfigService) {
    this.version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    this.whatsappToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    this.whatsappPhoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.pageToken = this.config.get<string>('MESSENGER_PAGE_ACCESS_TOKEN');
    this.pageId = this.config.get<string>('MESSENGER_PAGE_ID');

    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configuradas — el canal de WhatsApp no puede enviar mensajes.',
      );
    }
    if (!this.pageToken || !this.pageId) {
      this.logger.warn(
        'MESSENGER_PAGE_ACCESS_TOKEN o MESSENGER_PAGE_ID no configuradas — Messenger e Instagram no pueden enviar mensajes.',
      );
    }
  }

  async enviarMensajeSesion(
    canal: CanalMensajeria,
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
    if (canal === 'whatsapp') {
      await this.conReintentos(() => this.enviarWhatsapp(destinatarioId, texto));
      return;
    }
    // Messenger e Instagram comparten el mismo Send API una vez que la
    // cuenta de Instagram está vinculada a la Página de Facebook.
    await this.conReintentos(() => this.enviarMessengerOInstagram(destinatarioId, texto));
  }

  /**
   * Botón nativo de WhatsApp que abre el catálogo en el navegador — mejor
   * UX que mandar la lista completa de precios como texto. Messenger/
   * Instagram usan un formato de botón distinto (no armado todavía, sin
   * canal en producción para probarlo) — por ahora caen a texto plano.
   */
  async enviarBotonCatalogo(
    canal: CanalMensajeria,
    destinatarioId: string,
    url: string,
  ): Promise<void> {
    if (canal !== 'whatsapp') {
      await this.enviarMensajeSesion(
        canal,
        destinatarioId,
        `Mirá nuestro catálogo completo con fotos y precios acá: ${url}`,
      );
      return;
    }
    await this.conReintentos(() => this.enviarWhatsappBotonCatalogo(destinatarioId, url));
  }

  private async enviarWhatsappBotonCatalogo(destinatarioId: string, url: string): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new Error('WhatsApp no está configurado.');
    }
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: destinatarioId,
          type: 'interactive',
          interactive: {
            type: 'cta_url',
            body: { text: 'Mirá nuestro catálogo completo con fotos y precios 🍕' },
            action: {
              name: 'cta_url',
              parameters: { display_text: 'Ver catálogo', url },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`WhatsApp Graph API respondió ${res.status}: ${cuerpo}`);
    }
  }

  private async enviarWhatsapp(destinatarioId: string, texto: string): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new Error('WhatsApp no está configurado.');
    }
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: destinatarioId,
          type: 'text',
          text: { body: texto },
        }),
      },
    );
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`WhatsApp Graph API respondió ${res.status}: ${cuerpo}`);
    }
  }

  private async enviarMessengerOInstagram(
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
    if (!this.pageToken || !this.pageId) {
      throw new Error('Messenger/Instagram no están configurados.');
    }
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.pageId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.pageToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: destinatarioId },
          messaging_type: 'RESPONSE',
          message: { text: texto },
        }),
      },
    );
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Messenger/Instagram Graph API respondió ${res.status}: ${cuerpo}`);
    }
  }

  private async conReintentos(accion: () => Promise<void>): Promise<void> {
    let ultimoError: unknown;
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        await accion();
        return;
      } catch (err) {
        ultimoError = err;
        if (intento < REINTENTOS) {
          await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[intento]));
        }
      }
    }
    this.logger.error(
      `Falló el envío tras ${REINTENTOS + 1} intentos: ${(ultimoError as Error).message}`,
    );
    throw ultimoError;
  }
}
