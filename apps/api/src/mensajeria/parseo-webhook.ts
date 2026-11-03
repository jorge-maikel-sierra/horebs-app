import type { ItemCarritoResuelto } from '../catalog/catalog.service';
import {
  direccionDeUbicacion,
  esBotonCheckout,
  type EntradaCheckout,
} from './checkout-whatsapp';
import type { CanalMensajeria } from './conversaciones.service';
import {
  parsearMessengerOInstagram,
  type MessengerWebhookPayload,
} from './parseo-webhook-social';

export { parsearMessengerOInstagram, type MessengerWebhookPayload };

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
  mensajeId: string | null; // wamid (WhatsApp) o mid (Messenger/Instagram)
  carrito?: CarritoCatalogo;
  entrada?: EntradaCheckout;
  media?: { id: string; tipo: TipoMedia };
}

const MAX_CANTIDAD_ITEM = 20;

interface WhatsappOrden {
  catalog_id?: string;
  text?: string;
  product_items?: {
    product_retailer_id?: string;
    quantity?: number;
  }[];
}

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

export interface MetaReferral {
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

export function entradaCheckoutDe(
  mensaje: WhatsappMensaje,
): { entrada: EntradaCheckout; texto: string } | null {
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

function textoWhatsapp(mensaje: WhatsappMensaje): string | null {
  if (mensaje.type === 'text') return mensaje.text?.body ?? '';
  if (
    mensaje.type === 'interactive' &&
    mensaje.interactive?.type === 'button_reply'
  ) {
    return textoBotonPedir(mensaje.interactive.button_reply?.id ?? '');
  }
  return null;
}

function textoBotonPedir(id: string): string | null {
  const nombreProducto = id.startsWith('pedir:')
    ? id.slice('pedir:'.length)
    : null;
  return nombreProducto ? `Quiero pedir ${nombreProducto}` : null;
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

function contenidoWhatsapp(mensaje: WhatsappMensaje): {
  carrito: CarritoCatalogo | undefined;
  checkout: ReturnType<typeof entradaCheckoutDe>;
  media: ReturnType<typeof mediaDe>;
  texto: string | null;
} {
  const carrito =
    mensaje.type === 'order' && mensaje.order
      ? carritoDesdeOrden(mensaje.order)
      : undefined;
  if (carrito) return { carrito, checkout: null, media: null, texto: '' };
  const checkout = entradaCheckoutDe(mensaje);
  const media = checkout ? null : mediaDe(mensaje);
  const texto = checkout?.texto ?? media?.texto ?? textoWhatsapp(mensaje);
  return { carrito, checkout, media, texto };
}

function eventoWhatsapp(mensaje: WhatsappMensaje): EventoEntrante | null {
  const { carrito, checkout, media, texto } = contenidoWhatsapp(mensaje);
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
