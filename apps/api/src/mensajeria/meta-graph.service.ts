import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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

export interface SeccionListaProductos {
  titulo: string;
  /** `product_retailer_id` del catálogo de Meta = UUID de la variante. */
  retailerIds: string[];
}

export interface BotonRespuesta {
  id: string;
  titulo: string;
}

// Límites de WhatsApp para mensajes interactivos con botones.
const MAX_BOTONES = 3;
const MAX_TITULO_BOTON = 20;
const MAX_CUERPO = 1024;
const MAX_FILAS_LISTA = 10;
const MAX_BYTES_MEDIA = 10 * 1024 * 1024;
const MAX_TITULO_FILA = 24;

export interface ListaProductos {
  encabezado: string;
  cuerpo: string;
  secciones: SeccionListaProductos[];
}

// WhatsApp corta el título de un botón de respuesta a 20 caracteres — el
// nombre del producto va en el id del botón (hasta 256 caracteres), nunca
// en el título.
const TITULO_BOTON_AGREGAR = 'Agregar al pedido';

// Límites de Meta para un mensaje product_list — si se pasan, rechaza el
// mensaje entero en vez de recortarlo.
const MAX_ITEMS_LISTA = 30;
const MAX_SECCIONES_LISTA = 10;
const MAX_TITULO_SECCION = 24;
const MAX_ENCABEZADO_LISTA = 60;

/**
 * Recorta una lista a los límites de Meta: hasta 10 secciones, 30 ítems
 * en total (se llenan en orden, así las primeras secciones quedan
 * completas) y títulos cortos. Las secciones que quedan vacías se quitan.
 */
export function recortarListaProductos(lista: ListaProductos): ListaProductos {
  let disponibles = MAX_ITEMS_LISTA;
  const secciones: SeccionListaProductos[] = [];
  for (const seccion of lista.secciones.slice(0, MAX_SECCIONES_LISTA)) {
    const retailerIds = seccion.retailerIds.slice(0, disponibles);
    disponibles -= retailerIds.length;
    if (retailerIds.length === 0) continue;
    secciones.push({
      titulo: seccion.titulo.slice(0, MAX_TITULO_SECCION),
      retailerIds,
    });
  }
  return {
    encabezado: lista.encabezado.slice(0, MAX_ENCABEZADO_LISTA),
    cuerpo: lista.cuerpo,
    secciones,
  };
}

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
  private readonly whatsappCatalogId?: string;

  constructor(private readonly config: ConfigService) {
    this.version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    this.whatsappToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    this.whatsappPhoneNumberId = this.config.get<string>(
      'WHATSAPP_PHONE_NUMBER_ID',
    );
    // Catálogo de Meta Commerce conectado al número del bot. Sin él, el
    // bot vuelve al link del sitio y a las tarjetas con botón.
    this.whatsappCatalogId = this.config.get<string>('WHATSAPP_CATALOG_ID');
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

  /**
   * Doble check azul + "escribiendo…" en un solo llamado (Cloud API). El
   * indicador se apaga solo al responder o a los 25s. Fire-and-forget: es
   * cosmético, un error nunca frena la respuesta al cliente.
   */
  marcarLeidoEscribiendo(mensajeId: string): void {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) return;
    fetch(
      `https://graph.facebook.com/${this.version}/${this.whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: mensajeId,
          typing_indicator: { type: 'text' },
        }),
      },
    )
      .then(async (res) => {
        if (!res.ok) {
          const detalle = await res.text().catch(() => '');
          this.logger.warn(
            `No se pudo marcar leído/escribiendo ${mensajeId}: ${res.status} ${detalle}`,
          );
        }
      })
      .catch((err: Error) =>
        this.logger.warn(
          `No se pudo marcar leído/escribiendo ${mensajeId}: ${err.message}`,
        ),
      );
  }

  /**
   * Hasta 3 botones de respuesta (límite de WhatsApp, títulos de hasta 20
   * caracteres). El id vuelve en el webhook como `button_reply.id` — así el
   * checkout avanza sin interpretar texto libre.
   */
  async enviarBotones(
    destinatarioId: string,
    cuerpo: string,
    botones: BotonRespuesta[],
  ): Promise<void> {
    await this.conReintentos(() =>
      this.enviarWhatsappInteractivo(destinatarioId, {
        type: 'button',
        body: { text: normalizarNegritaWhatsapp(cuerpo).slice(0, MAX_CUERPO) },
        action: {
          buttons: botones.slice(0, MAX_BOTONES).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.titulo.slice(0, MAX_TITULO_BOTON) },
          })),
        },
      }),
    );
  }

  /**
   * Lista interactiva (hasta 10 filas, títulos de 24 caracteres): el cliente
   * toca "Elegir" y elige una opción. Vuelve como `list_reply.id`.
   */
  async enviarLista(
    destinatarioId: string,
    datos: { cuerpo: string; boton: string; filas: BotonRespuesta[] },
  ): Promise<void> {
    await this.conReintentos(() =>
      this.enviarWhatsappInteractivo(destinatarioId, {
        type: 'list',
        body: {
          text: normalizarNegritaWhatsapp(datos.cuerpo).slice(0, MAX_CUERPO),
        },
        action: {
          button: datos.boton.slice(0, MAX_TITULO_BOTON),
          sections: [
            {
              rows: datos.filas.slice(0, MAX_FILAS_LISTA).map((f) => ({
                id: f.id,
                title: f.titulo.slice(0, MAX_TITULO_FILA),
              })),
            },
          ],
        },
      }),
    );
  }

  /**
   * Descarga un archivo que mandó el cliente (foto, PDF, nota de voz): la
   * Cloud API primero da una URL temporal por id y después se baja con el
   * mismo token. Tope de 10 MB — un comprobante o un audio corto pesan
   * mucho menos.
   */
  async descargarMedia(
    mediaId: string,
  ): Promise<{ datos: Buffer; mime: string }> {
    if (!this.whatsappToken) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
    }
    const auth = { Authorization: `Bearer ${this.whatsappToken}` };
    const meta = await fetch(
      `https://graph.facebook.com/${this.version}/${mediaId}`,
      { headers: auth },
    );
    if (!meta.ok) {
      throw new ServiceUnavailableException(
        `No se pudo obtener el archivo ${mediaId}: ${meta.status}`,
      );
    }
    const info = (await meta.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!info.url) {
      throw new ServiceUnavailableException(
        `El archivo ${mediaId} no tiene URL.`,
      );
    }
    if ((info.file_size ?? 0) > MAX_BYTES_MEDIA) {
      throw new ServiceUnavailableException(
        `El archivo ${mediaId} pesa más de 10 MB.`,
      );
    }
    const archivo = await fetch(info.url, { headers: auth });
    if (!archivo.ok) {
      throw new ServiceUnavailableException(
        `No se pudo descargar el archivo ${mediaId}: ${archivo.status}`,
      );
    }
    return {
      datos: Buffer.from(await archivo.arrayBuffer()),
      mime: info.mime_type ?? 'application/octet-stream',
    };
  }

  /** Botón nativo "Enviar ubicación" — la respuesta llega como mensaje `location`. */
  async pedirUbicacion(destinatarioId: string, cuerpo: string): Promise<void> {
    await this.conReintentos(() =>
      this.enviarWhatsappInteractivo(destinatarioId, {
        type: 'location_request_message',
        body: { text: normalizarNegritaWhatsapp(cuerpo).slice(0, MAX_CUERPO) },
        action: { name: 'send_location' },
      }),
    );
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
   * Catálogo nativo de WhatsApp (fotos, precios y carrito dentro del
   * chat) — la venta no sale de WhatsApp. Sin catálogo conectado, o en
   * Messenger/Instagram que no tienen catálogo, cae al link del sitio.
   * Devuelve qué se mandó para que quien llama lo registre igual.
   */
  async enviarCatalogo(
    canal: CanalMensajeria,
    destinatarioId: string,
    urlFallback: string,
    miniaturaRetailerId?: string,
  ): Promise<'catalogo' | 'link'> {
    if (canal !== 'whatsapp' || !this.whatsappCatalogId) {
      await this.enviarBotonCatalogo(canal, destinatarioId, urlFallback);
      return 'link';
    }
    try {
      await this.conReintentos(() =>
        this.enviarWhatsappInteractivo(destinatarioId, {
          type: 'catalog_message',
          body: {
            text: 'Acá tenés nuestro menú 🍕 Elegí lo que quieras, agregalo al carrito y mandámelo por acá.',
          },
          action: {
            name: 'catalog_message',
            ...(miniaturaRetailerId
              ? {
                  parameters: {
                    thumbnail_product_retailer_id: miniaturaRetailerId,
                  },
                }
              : {}),
          },
        }),
      );
      return 'catalogo';
    } catch (err) {
      this.logger.warn(
        `catalog_message rechazado, se manda el link: ${(err as Error).message}`,
      );
      await this.enviarBotonCatalogo(canal, destinatarioId, urlFallback);
      return 'link';
    }
  }

  /**
   * Lista nativa de productos del catálogo (product_list), agrupada en
   * secciones — el cliente agrega al carrito sin salir del chat. Sin
   * catálogo conectado, o fuera de WhatsApp, cae a las tarjetas con botón.
   */
  async enviarListaProductos(
    canal: CanalMensajeria,
    destinatarioId: string,
    lista: ListaProductos,
    tarjetasFallback: TarjetaProducto[],
  ): Promise<'lista' | 'tarjetas'> {
    const recortada = recortarListaProductos(lista);
    if (
      canal !== 'whatsapp' ||
      !this.whatsappCatalogId ||
      recortada.secciones.length === 0
    ) {
      await this.enviarTarjetasProductos(
        canal,
        destinatarioId,
        tarjetasFallback,
      );
      return 'tarjetas';
    }
    const catalogId = this.whatsappCatalogId;
    try {
      await this.conReintentos(() =>
        this.enviarWhatsappInteractivo(destinatarioId, {
          type: 'product_list',
          header: { type: 'text', text: recortada.encabezado },
          body: { text: recortada.cuerpo },
          action: {
            catalog_id: catalogId,
            sections: recortada.secciones.map((s) => ({
              title: s.titulo,
              product_items: s.retailerIds.map((id) => ({
                product_retailer_id: id,
              })),
            })),
          },
        }),
      );
      return 'lista';
    } catch (err) {
      // El feed del catálogo se refresca cada hora: un producto recién
      // creado en Supabase puede no estar todavía en Meta, y Meta rechaza
      // la lista entera por un solo id desconocido. Mejor tarjetas que
      // dejar al cliente sin respuesta.
      this.logger.warn(
        `product_list rechazado, se mandan tarjetas: ${(err as Error).message}`,
      );
      await this.enviarTarjetasProductos(
        canal,
        destinatarioId,
        tarjetasFallback,
      );
      return 'tarjetas';
    }
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

  private async enviarWhatsappBotonCatalogo(
    destinatarioId: string,
    url: string,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
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
      throw new ServiceUnavailableException(
        `WhatsApp Graph API respondió ${res.status}: ${cuerpo}`,
      );
    }
  }

  private async enviarWhatsappInteractivo(
    destinatarioId: string,
    interactive: Record<string, unknown>,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
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
          interactive,
        }),
      },
    );
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `WhatsApp Graph API respondió ${res.status}: ${detalle}`,
      );
    }
  }

  private async enviarWhatsappTarjetaProducto(
    destinatarioId: string,
    producto: TarjetaProducto,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
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
      throw new ServiceUnavailableException(
        `WhatsApp Graph API respondió ${res.status}: ${detalle}`,
      );
    }
  }

  private async enviarWhatsapp(
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp no está configurado.');
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
      throw new ServiceUnavailableException(
        `WhatsApp Graph API respondió ${res.status}: ${cuerpo}`,
      );
    }
  }

  private async enviarMessengerOInstagram(
    destinatarioId: string,
    texto: string,
  ): Promise<void> {
    if (!this.pageToken || !this.pageId) {
      throw new ServiceUnavailableException(
        'Messenger/Instagram no están configurados.',
      );
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
      throw new ServiceUnavailableException(
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
