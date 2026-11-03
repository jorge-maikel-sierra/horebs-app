import {
  direccionDeUbicacion,
  esBotonCheckout,
  type EntradaCheckout,
} from './checkout-whatsapp';
import type {
  EventoEntrante,
  MetaReferral,
  ProcedenciaAnuncio,
  TipoMedia,
} from './parseo-webhook';

interface MetaAttachment {
  type?: string;
  payload?: {
    url?: string;
    coordinates?: { lat: number; long: number };
  };
}

export interface MessengerEvento {
  sender?: { id?: string };
  message?: {
    text?: string;
    is_echo?: boolean;
    is_self?: boolean;
    is_deleted?: boolean;
    mid?: string;
    quick_reply?: { payload?: string };
    attachments?: MetaAttachment[];
    reply_to?: { story?: { id?: string; url?: string } };
    referral?: MetaReferral;
  };
  postback?: {
    payload?: string;
    title?: string;
    referral?: MetaReferral;
  };
  referral?: MetaReferral;
}

export interface MessengerWebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    messaging?: MessengerEvento[];
  }[];
}

function textoBotonPedir(id: string): string | null {
  const prefijo = 'pedir:';
  return id.startsWith(prefijo)
    ? `Quiero pedir ${id.slice(prefijo.length)}`
    : null;
}

function procedenciaMessenger(
  evento: MessengerEvento,
): ProcedenciaAnuncio | null {
  const referral =
    evento.referral ?? evento.message?.referral ?? evento.postback?.referral;
  if (!referral) return null;
  return {
    esAnuncio: referral.source === 'ADS' || Boolean(referral.ad_id),
    anuncioId: referral.ad_id,
    fuente: referral.source,
  };
}

function esMensajeIgnorado(
  evento: MessengerEvento,
  canal: 'messenger' | 'instagram',
): boolean {
  if (!evento?.sender?.id) return true;
  const msg = evento.message;
  if (!msg) return !evento.postback;
  const esPropio = canal === 'instagram' && msg.is_self;
  return Boolean(msg.is_echo || msg.is_deleted || esPropio);
}

function resolverPayload(
  payload: string,
  titulo: string,
): { texto: string; entrada?: EntradaCheckout } {
  if (esBotonCheckout(payload)) {
    return { entrada: { tipo: 'boton', id: payload }, texto: titulo };
  }
  const botonPedir = textoBotonPedir(payload);
  if (botonPedir) {
    return { texto: botonPedir };
  }
  return { texto: titulo || payload };
}

function mediaDeAttachment(
  att: MetaAttachment,
): { id: string; tipo: TipoMedia; texto: string } | null {
  const url = att.payload?.url;
  if (!url) return null;
  if (att.type === 'image') {
    return { id: url, tipo: 'imagen', texto: '📎 Imagen' };
  }
  if (att.type === 'audio') {
    return { id: url, tipo: 'audio', texto: '🎤 Nota de voz' };
  }
  return null;
}

function ubicacionDeAttachment(
  att: MetaAttachment,
): { entrada: EntradaCheckout; texto: string } | null {
  if (att.type !== 'location' || !att.payload?.coordinates) return null;
  const u = {
    tipo: 'ubicacion' as const,
    latitud: att.payload.coordinates.lat,
    longitud: att.payload.coordinates.long,
  };
  return {
    entrada: u,
    texto: `Ubicación compartida: ${direccionDeUbicacion(u)}`,
  };
}

function esContenidoCompartidoIG(tipo?: string): boolean {
  return tipo === 'ig_post' || tipo === 'story_mention' || tipo === 'reel';
}

function resolverAttachments(attachments: MetaAttachment[]): {
  texto?: string;
  entrada?: EntradaCheckout;
  media?: { id: string; tipo: TipoMedia };
} | null {
  for (const att of attachments) {
    const ubicacion = ubicacionDeAttachment(att);
    if (ubicacion) return ubicacion;
    const media = mediaDeAttachment(att);
    if (media) {
      return {
        media: { id: media.id, tipo: media.tipo },
        texto: media.texto,
      };
    }
    if (esContenidoCompartidoIG(att.type)) {
      return { texto: 'El cliente compartió contenido de Instagram.' };
    }
  }
  return null;
}

function payloadDeEvento(evento: MessengerEvento): {
  payload?: string;
  titulo: string;
} {
  const payload =
    evento.message?.quick_reply?.payload ?? evento.postback?.payload;
  const titulo =
    evento.message?.text ?? evento.postback?.title ?? payload ?? '';
  return { payload, titulo };
}

function textoDeMensaje(msg?: MessengerEvento['message']): string | null {
  if (!msg?.text) return null;
  return msg.reply_to?.story ? `[Respuesta a historia] ${msg.text}` : msg.text;
}

function contenidoSocial(evento: MessengerEvento): {
  texto: string | null;
  entrada?: EntradaCheckout;
  media?: { id: string; tipo: TipoMedia };
} | null {
  const { payload, titulo } = payloadDeEvento(evento);
  if (payload) {
    return resolverPayload(payload, titulo);
  }
  const att = resolverAttachments(evento.message?.attachments ?? []);
  if (att) {
    return {
      texto: evento.message?.text ?? att.texto ?? '',
      entrada: att.entrada,
      media: att.media,
    };
  }
  const texto = textoDeMensaje(evento.message);
  return texto ? { texto } : null;
}

function eventoMessenger(
  evento: MessengerEvento,
  canal: 'messenger' | 'instagram',
): EventoEntrante | null {
  if (esMensajeIgnorado(evento, canal)) return null;
  const remitente = evento.sender?.id;
  if (!remitente) return null;

  const resuelto = contenidoSocial(evento);
  if (!resuelto?.texto) return null;

  return {
    canal,
    identificadorExterno: remitente,
    telefono: null,
    texto: resuelto.texto,
    procedenciaAnuncio: procedenciaMessenger(evento),
    mensajeId: evento.message?.mid ?? null,
    entrada: resuelto.entrada,
    media: resuelto.media,
  };
}

export function parsearMessengerOInstagram(
  payload: MessengerWebhookPayload,
  canal: 'messenger' | 'instagram',
  cuentaEsperadaId?: string,
): EventoEntrante[] {
  const objetoEsperado = canal === 'messenger' ? 'page' : 'instagram';
  if (payload?.object && payload.object !== objetoEsperado) {
    return [];
  }
  return (payload?.entry ?? []).flatMap((entry) => {
    if (cuentaEsperadaId && entry?.id && entry.id !== cuentaEsperadaId) {
      return [];
    }
    return (entry?.messaging ?? []).flatMap(
      (evento) => eventoMessenger(evento, canal) ?? [],
    );
  });
}
