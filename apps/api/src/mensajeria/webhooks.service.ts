import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CatalogService,
  type ItemCarritoResuelto,
} from '../catalog/catalog.service';
import { GeminiService } from './gemini.service';
import { MetaGraphService } from './meta-graph.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import {
  direccionDeUbicacion,
  esBotonCheckout,
  esSaludoOIntencionDePedir,
  type EntradaCheckout,
} from './checkout-whatsapp';
import {
  ConversacionesService,
  type CanalMensajeria,
} from './conversaciones.service';

export interface ProcedenciaAnuncio {
  esAnuncio: boolean;
  anuncioId?: string;
  fuente?: string;
  /** Id del clic (solo Click-to-WhatsApp) — lo necesita la API de conversiones. */
  ctwaClid?: string;
}

export interface CarritoCatalogo {
  items: { varianteId: string; cantidad: number }[];
  nota: string | null;
}

export interface EventoEntrante {
  canal: CanalMensajeria;
  identificadorExterno: string; // wa_id de WhatsApp, o PSID/IGSID de Messenger/Instagram
  telefono: string | null; // solo WhatsApp expone el teléfono real
  texto: string;
  procedenciaAnuncio: ProcedenciaAnuncio | null;
  mensajeId: string | null; // wamid (WhatsApp) o mid (Messenger/Instagram) — para deduplicar reenvíos de Meta
  /** Carrito enviado desde el catálogo de WhatsApp — `texto` se arma al procesarlo. */
  carrito?: CarritoCatalogo;
  /** Toque de un botón del checkout (`ck:*`) o ubicación compartida. */
  entrada?: EntradaCheckout;
}

// Mismo tope que calcular_pedido en gemini.service.ts.
const MAX_CANTIDAD_ITEM = 20;

interface WhatsappOrden {
  catalog_id?: string;
  text?: string;
  product_items?: {
    product_retailer_id?: string;
    quantity?: number;
    // item_price y currency también llegan, pero se ignoran a propósito:
    // el precio sale siempre de Supabase (calcular_pedido).
  }[];
}

/**
 * Carrito de un mensaje `order` de WhatsApp. Solo se toma el id de la
 * variante y la cantidad (acotada a 1–20) — nunca el precio que manda el
 * cliente, que se recalcula desde la base.
 */
export function carritoDesdeOrden(orden: WhatsappOrden): CarritoCatalogo {
  const items = (orden.product_items ?? []).flatMap((item) => {
    if (!item.product_retailer_id) return [];
    const cantidad = Math.round(Number(item.quantity ?? 1)) || 1;
    return [
      {
        varianteId: item.product_retailer_id,
        cantidad: Math.min(Math.max(cantidad, 1), MAX_CANTIDAD_ITEM),
      },
    ];
  });
  return { items, nota: orden.text?.trim() || null };
}

/**
 * Texto sintético que recibe Gemini en lugar del carrito — mismo criterio
 * que "Quiero pedir …" del botón de las tarjetas: el modelo sigue el flujo
 * normal de toma de pedido con productos que ya existen en el catálogo.
 * Sin precios: el total lo calcula calcular_pedido desde la base.
 */
export function textoCarritoCatalogo(
  disponibles: ItemCarritoResuelto[],
  noDisponibles: number,
  nota: string | null,
): string {
  if (disponibles.length === 0) {
    return 'Envié mi carrito del catálogo, pero ninguno de esos productos está disponible en este momento.';
  }
  const items = disponibles
    .map(
      (i) =>
        `${i.cantidad}x ${i.productoNombre}${i.conTamanos ? ` (${i.varianteNombre})` : ''}`,
    )
    .join(', ');
  return [
    `Envié mi carrito del catálogo: ${items}.`,
    noDisponibles > 0
      ? `(${noDisponibles} producto(s) del carrito ya no están disponibles.)`
      : null,
    nota ? `Nota: ${nota}` : null,
  ]
    .filter(Boolean)
    .join(' ');
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
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
  };
  order?: WhatsappOrden;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/**
 * Toque de un botón del checkout o ubicación compartida → entrada para
 * CheckoutWhatsappService, con un texto legible para el historial.
 */
export function entradaCheckoutDe(
  mensaje: WhatsappMensaje,
): { entrada: EntradaCheckout; texto: string } | null {
  const boton =
    mensaje.type === 'interactive' &&
    mensaje.interactive?.type === 'button_reply'
      ? mensaje.interactive.button_reply
      : undefined;
  if (boton && esBotonCheckout(boton.id)) {
    return { entrada: { tipo: 'boton', id: boton.id }, texto: boton.title };
  }
  if (mensaje.type === 'location' && mensaje.location) {
    const ubicacion = {
      tipo: 'ubicacion' as const,
      latitud: mensaje.location.latitude,
      longitud: mensaje.location.longitude,
      direccion: mensaje.location.address,
      nombre: mensaje.location.name,
    };
    return {
      entrada: ubicacion,
      texto: `Ubicación compartida: ${direccionDeUbicacion(ubicacion)}`,
    };
  }
  return null;
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
    private readonly catalog: CatalogService,
    private readonly checkout: CheckoutWhatsappService,
  ) {}

  verificarFirma(
    appSecret: string,
    rawBody: Buffer,
    firmaHeader: string | undefined,
  ): boolean {
    if (!firmaHeader?.startsWith('sha256=')) return false;

    const firmaRecibida = Buffer.from(
      firmaHeader.slice('sha256='.length),
      'hex',
    );
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
        duplicado = await this.conversaciones.yaProcesado(
          evento.canal,
          evento.mensajeId,
        );
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

    let carritoValidado: {
      disponibles: ItemCarritoResuelto[];
      noDisponibles: number;
    } | null = null;
    if (evento.carrito) {
      carritoValidado = await this.catalog.resolverCarrito(
        evento.carrito.items,
      );
      evento.texto = textoCarritoCatalogo(
        carritoValidado.disponibles,
        carritoValidado.noDisponibles,
        evento.carrito.nota,
      );
    }

    const conversacion = await this.conversaciones.registrarInteraccion(
      evento.canal,
      evento.identificadorExterno,
    );
    const ctwaClid = evento.procedenciaAnuncio?.ctwaClid;
    if (evento.canal === 'whatsapp' && ctwaClid) {
      // Fire-and-forget: si falla (ej. la columna todavía no existe) no
      // debe tumbar ni demorar la respuesta al cliente — es un dato para
      // medición, no para el bot, y se lee recién al derivar.
      void this.conversaciones
        .guardarCtwaClid(evento.canal, evento.identificadorExterno, ctwaClid)
        .catch((err: Error) =>
          this.logger.error(
            `No se pudo guardar el ctwa_clid de ${evento.identificadorExterno}: ${err.message}`,
          ),
        );
    }
    // Se persiste el mensaje entrante ANTES del corte por `derivado` de
    // abajo — si no, el mensaje del cliente se perdía por completo una vez
    // que la conversación ya estaba en manos de una persona.
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'entrante',
      evento.texto,
    );
    if (conversacion.estado === 'derivado') {
      this.logger.log(
        `Conversación ya derivada a humano, no se auto-responde — canal=${evento.canal} id=${evento.identificadorExterno}`,
      );
      return;
    }
    // Solo cuando el bot va a responder: Meta pide no mostrar "escribiendo…"
    // si no va a llegar una respuesta.
    if (evento.canal === 'whatsapp' && evento.mensajeId) {
      this.metaGraph.marcarLeidoEscribiendo(evento.mensajeId);
    }

    // Checkout determinístico por botones: carrito, toques, ubicación y
    // las respuestas de cada paso no pasan por Gemini.
    if (evento.canal === 'whatsapp') {
      const ctx = {
        identificadorExterno: evento.identificadorExterno,
        conversacionId: conversacion.id,
        mensajeId: evento.mensajeId,
      };
      if (carritoValidado) {
        await this.checkout.iniciar(
          ctx,
          carritoValidado.disponibles,
          carritoValidado.noDisponibles,
          evento.carrito?.nota ?? null,
        );
        return;
      }
      const entrada = evento.entrada ?? {
        tipo: 'texto' as const,
        texto: evento.texto,
      };
      if (await this.checkout.manejar(ctx, entrada)) return;
      if (
        !evento.entrada &&
        esSaludoOIntencionDePedir(evento.texto) &&
        !(await this.conversaciones.obtenerUltimaInteraccionGemini(
          evento.canal,
          evento.identificadorExterno,
        )) &&
        (await this.checkout.ofrecerLoMismo(ctx))
      ) {
        return;
      }
    }

    const respuesta = await this.gemini.responder(
      evento.canal,
      evento.identificadorExterno,
      evento.telefono,
      evento.texto,
      conversacion.id,
    );
    // null = la herramienta (ej. el botón de catálogo) ya mandó el mensaje
    // y ya lo dejó registrado ella misma (ver gemini.service.ts).
    if (respuesta === null) return;
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
  }

  /**
   * Texto plano tal cual, o texto sintético cuando el cliente tocó el
   * botón "Agregar al pedido" de una tarjeta de producto (mostrar_productos
   * en gemini.service.ts) — el id del botón lleva el nombre del producto,
   * nunca un id de base de datos, así no hace falta volver a consultar
   * nada acá: se arma un mensaje natural y Gemini sigue el flujo normal
   * de toma de pedido como si el cliente lo hubiera escrito.
   */
  private textoWhatsapp(mensaje: WhatsappMensaje): string | null {
    if (mensaje.type === 'text') return mensaje.text?.body ?? '';
    if (
      mensaje.type === 'interactive' &&
      mensaje.interactive?.type === 'button_reply'
    ) {
      const id = mensaje.interactive.button_reply?.id ?? '';
      const nombreProducto = id.startsWith('pedir:')
        ? id.slice('pedir:'.length)
        : null;
      return nombreProducto ? `Quiero pedir ${nombreProducto}` : null;
    }
    return null;
  }

  private parsearWhatsapp(payload: WhatsappWebhookPayload): EventoEntrante[] {
    const eventos: EventoEntrante[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const mensaje of change?.value?.messages ?? []) {
          const carrito =
            mensaje.type === 'order' && mensaje.order
              ? carritoDesdeOrden(mensaje.order)
              : undefined;
          const checkout = carrito ? null : entradaCheckoutDe(mensaje);
          const texto = carrito
            ? ''
            : (checkout?.texto ?? this.textoWhatsapp(mensaje));
          // Texto, toques de botón, ubicación y carrito del catálogo —
          // audio e imagen quedan para una extensión posterior.
          if (texto === null) continue;
          eventos.push({
            canal: 'whatsapp',
            identificadorExterno: mensaje.from,
            telefono: mensaje.from,
            texto,
            procedenciaAnuncio: this.extraerProcedenciaWhatsapp(mensaje),
            mensajeId: mensaje.id ?? null,
            carrito,
            entrada: checkout?.entrada,
          });
        }
      }
    }
    return eventos;
  }

  private extraerProcedenciaWhatsapp(
    mensaje: WhatsappMensaje,
  ): ProcedenciaAnuncio | null {
    const referral = mensaje.referral;
    if (!referral) return null;
    return {
      esAnuncio: true,
      anuncioId: referral.source_id ?? referral.ctwa_clid,
      fuente: referral.source_type ?? 'ad',
      ctwaClid: referral.ctwa_clid,
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

  private extraerProcedenciaMessenger(
    evento: MessengerEvento,
  ): ProcedenciaAnuncio | null {
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
