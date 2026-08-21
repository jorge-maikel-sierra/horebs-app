import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CanalMensajeria } from './conversaciones.service';

const REINTENTOS = 2;
const BACKOFF_MS = [500, 1500];

export interface TarjetaProducto {
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  precioDesde: number;
}

// WhatsApp corta el título de un botón de respuesta a 20 caracteres — el
// nombre del producto va en el id del botón (hasta 256 caracteres), nunca
// en el título.
const TITULO_BOTON_AGREGAR = 'Agregar al pedido';

/**
 * Gemini responde en Markdown estándar (**negrita**), pero WhatsApp solo
 * reconoce un asterisco de cada lado (*negrita*) — con doble asterisco no
 * lo interpreta como formato y lo muestra literal. Se normaliza acá, en el
 * único punto de salida real, para cubrir cualquier texto saliente sin
 * importar de dónde venga.
 */
function normalizarNegritaWhatsapp(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, '*$1*');
}

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
    this.whatsappPhoneNumberId = this.config.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );
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
    const textoNormalizado = normalizarNegritaWhatsapp(texto);
    if (canal === 'whatsapp') {
      await this.conReintentos(() =>
        this.enviarWhatsapp(destinatarioId, textoNormalizado),
      );
      return;
    }
    // Messenger e Instagram comparten el mismo Send API una vez que la
    // cuenta de Instagram está vinculada a la Página de Facebook.
    await this.conReintentos(() =>
      this.enviarMessengerOInstagram(destinatarioId, textoNormalizado),
    );
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
    await this.conReintentos(() =>
      this.enviarWhatsappBotonCatalogo(destinatarioId, url),
    );
  }

  /**
   * Manda hasta 3 productos como tarjetas separadas (imagen + nombre +
   * precio + botón "Agregar al pedido") en vez de una lista de precios en
   * texto — mejor UX para elegir. Sin catálogo de Meta Commerce vinculado,
   * no existe un carrusel nativo de WhatsApp fuera de plantillas
   * aprobadas — se arma a mano con mensajes interactivos tipo botón, uno
   * por producto, cada uno con su propia imagen como header. El id del
   * botón lleva el nombre del producto (no un UUID) para que, al tocarlo,
   * el webhook pueda armar un mensaje de texto natural sin tener que
   * volver a consultar la base — Gemini sigue el flujo de pedido normal
   * desde ahí. Solo WhatsApp — Messenger/Instagram no soportan botones
   * con imagen del mismo modo y no hay canal en producción para probarlo.
   */
  async enviarTarjetasProductos(
    canal: CanalMensajeria,
    destinatarioId: string,
    productos: TarjetaProducto[],
  ): Promise<void> {
    if (canal !== 'whatsapp') {
      const lista = productos
        .map(
          (p) =>
            `• ${p.nombre}: desde $${p.precioDesde.toLocaleString('es-CO')}`,
        )
        .join('\n');
      await this.enviarMensajeSesion(
        canal,
        destinatarioId,
        `Estas son algunas opciones:\n${lista}`,
      );
      return;
    }
    for (const producto of productos) {
      await this.conReintentos(() =>
        this.enviarWhatsappTarjetaProducto(destinatarioId, producto),
      );
    }
  }

  /**
   * Manda un PDF por WhatsApp (ej. comprobante de pedido desde el panel de
   * admin). Solo WhatsApp — Messenger/Instagram no están armados para esto
   * y no se pidió. Igual que cualquier mensaje de sesión, solo funciona
   * dentro de la ventana de 24h desde el último mensaje del cliente; fuera
   * de esa ventana la Graph API rechaza el envío (haría falta una
   * plantilla aprobada, que este módulo no implementa a propósito).
   */
  async enviarDocumentoWhatsapp(
    destinatarioId: string,
    pdf: Buffer,
    nombreArchivo: string,
    caption?: string,
  ): Promise<void> {
    await this.conReintentos(() =>
      this.enviarWhatsappDocumento(destinatarioId, pdf, nombreArchivo, caption),
    );
  }

  private async enviarWhatsappDocumento(
    destinatarioId: string,
    pdf: Buffer,
    nombreArchivo: string,
    caption?: string,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new Error('WhatsApp no está configurado.');
    }

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append(
      'file',
      new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
      nombreArchivo,
    );

    const resMedia = await fetch(
      `https://graph.facebook.com/${this.version}/${this.whatsappPhoneNumberId}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.whatsappToken}` },
        body: form,
      },
    );
    if (!resMedia.ok) {
      const cuerpo = await resMedia.text().catch(() => '');
      throw new Error(
        `WhatsApp Media API respondió ${resMedia.status}: ${cuerpo}`,
      );
    }
    const { id: mediaId } = (await resMedia.json()) as { id: string };

    const resMensaje = await fetch(
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
          type: 'document',
          document: { id: mediaId, filename: nombreArchivo, caption },
        }),
      },
    );
    if (!resMensaje.ok) {
      const cuerpo = await resMensaje.text().catch(() => '');
      throw new Error(
        `WhatsApp Graph API respondió ${resMensaje.status}: ${cuerpo}`,
      );
    }
  }

  private async enviarWhatsappBotonCatalogo(
    destinatarioId: string,
    url: string,
  ): Promise<void> {
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
            body: {
              text: 'Mirá nuestro catálogo completo con fotos y precios 🍕',
            },
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

  private async enviarWhatsappTarjetaProducto(
    destinatarioId: string,
    producto: TarjetaProducto,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new Error('WhatsApp no está configurado.');
    }
    const cuerpo = [
      producto.descripcion,
      `Desde $${producto.precioDesde.toLocaleString('es-CO')}`,
    ]
      .filter(Boolean)
      .join('\n');

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
            type: 'button',
            header: producto.imagenUrl
              ? { type: 'image', image: { link: producto.imagenUrl } }
              : { type: 'text', text: producto.nombre },
            body: {
              text: producto.imagenUrl
                ? cuerpo
                : `*${producto.nombre}*\n${cuerpo}`,
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: `pedir:${producto.nombre}`,
                    title: TITULO_BOTON_AGREGAR,
                  },
                },
              ],
            },
          },
        }),
      },
    );
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new Error(`WhatsApp Graph API respondió ${res.status}: ${detalle}`);
    }
  }

  private async enviarWhatsapp(
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
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
      throw new Error(
        `Messenger/Instagram Graph API respondió ${res.status}: ${cuerpo}`,
      );
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
          // intento es un contador interno del for (0..REINTENTOS), nunca
          // input externo — no hay injection posible acá.
          await new Promise((resolve) =>
            // eslint-disable-next-line security/detect-object-injection
            setTimeout(resolve, BACKOFF_MS[intento]),
          );
        }
      }
    }
    this.logger.error(
      `Falló el envío tras ${REINTENTOS + 1} intentos: ${(ultimoError as Error).message}`,
    );
    throw ultimoError;
  }
}
