import type { ItemCarritoResuelto } from '../catalog/catalog.service';
import {
  direccionDeUbicacion,
  esBotonCheckout,
  type EntradaCheckout,
} from './checkout-whatsapp';
import type { CanalMensajeria } from './conversaciones.service';
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
  /** Foto, documento o nota de voz. */
  media?: { id: string; tipo: TipoMedia };
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

export interface WhatsappMensaje {
  type: string;
  from: string;
  id?: string;
  text?: { body?: string };
  referral?: MetaReferral;
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  order?: WhatsappOrden;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  image?: { id: string; caption?: string };
  document?: { id: string; filename?: string; caption?: string };
  audio?: { id: string; voice?: boolean };
}

export type TipoMedia = 'imagen' | 'documento' | 'audio';

/**
 * Foto, documento o nota de voz: el archivo se descarga después por id.
 * El texto es lo que queda en el historial de la conversación.
 */
export function mediaDe(
  mensaje: WhatsappMensaje,
): { id: string; tipo: TipoMedia; texto: string } | null {
  if (mensaje.type === 'image' && mensaje.image) {
    const caption = mensaje.image.caption?.trim();
    return {
      id: mensaje.image.id,
      tipo: 'imagen',
      texto: `📎 Imagen${caption ? `: ${caption}` : ''}`,
    };
  }
  if (mensaje.type === 'document' && mensaje.document) {
    return {
      id: mensaje.document.id,
      tipo: 'documento',
      texto: `📎 Documento${mensaje.document.filename ? `: ${mensaje.document.filename}` : ''}`,
    };
  }
  if (mensaje.type === 'audio' && mensaje.audio) {
    return { id: mensaje.audio.id, tipo: 'audio', texto: '🎤 Nota de voz' };
  }
  return null;
}

/**
 * Toque de un botón del checkout o ubicación compartida → entrada para
 * CheckoutWhatsappService, con un texto legible para el historial.
 */
export function entradaCheckoutDe(
  mensaje: WhatsappMensaje,
): { entrada: EntradaCheckout; texto: string } | null {
  // Botón de respuesta o fila de una lista (franjas de entrega): mismo trato.
  const boton =
    mensaje.type === 'interactive'
      ? mensaje.interactive?.type === 'button_reply'
        ? mensaje.interactive.button_reply
        : mensaje.interactive?.type === 'list_reply'
          ? mensaje.interactive.list_reply
          : undefined
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

export interface WhatsappWebhookPayload {
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

export interface MessengerWebhookPayload {
  entry?: {
    messaging?: MessengerEvento[];
  }[];
}

/**
 * Texto plano tal cual, o texto sintético cuando el cliente tocó el
 * botón "Agregar al pedido" de una tarjeta de producto (mostrar_productos
 * en gemini.service.ts) — el id del botón lleva el nombre del producto,
 * nunca un id de base de datos, así no hace falta volver a consultar
 * nada acá: se arma un mensaje natural y Gemini sigue el flujo normal
 * de toma de pedido como si el cliente lo hubiera escrito.
 */
function textoWhatsapp(mensaje: WhatsappMensaje): string | null {
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

function procedenciaWhatsapp(
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

function procedenciaMessenger(
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

function eventoWhatsapp(mensaje: WhatsappMensaje): EventoEntrante | null {
  const carrito =
    mensaje.type === 'order' && mensaje.order
      ? carritoDesdeOrden(mensaje.order)
      : undefined;
  const checkout = carrito ? null : entradaCheckoutDe(mensaje);
  const media = carrito || checkout ? null : mediaDe(mensaje);
  const texto = carrito
    ? ''
    : (checkout?.texto ?? media?.texto ?? textoWhatsapp(mensaje));
  // Texto, toques de botón, ubicación y carrito del catálogo — audio e
  // imagen quedan para una extensión posterior.
  if (texto === null) return null;
  return {
    canal: 'whatsapp',
    identificadorExterno: mensaje.from,
    telefono: mensaje.from,
    texto,
    procedenciaAnuncio: procedenciaWhatsapp(mensaje),
    mensajeId: mensaje.id ?? null,
    carrito,
    entrada: checkout?.entrada,
    media: media ? { id: media.id, tipo: media.tipo } : undefined,
  };
}

export function parsearWhatsapp(
  payload: WhatsappWebhookPayload,
): EventoEntrante[] {
  const mensajes = (payload?.entry ?? []).flatMap((entry) =>
    (entry?.changes ?? []).flatMap((change) => change?.value?.messages ?? []),
  );
  return mensajes.flatMap((mensaje) => eventoWhatsapp(mensaje) ?? []);
}

export function parsearMessengerOInstagram(
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
        procedenciaAnuncio: procedenciaMessenger(evento),
        mensajeId: evento.message?.mid ?? null,
      });
    }
  }
  return eventos;
}
