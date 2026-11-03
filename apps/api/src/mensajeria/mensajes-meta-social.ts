import type { BotonRespuesta, TarjetaProducto } from './mensajes-interactivos';
import { pesos } from './resumen-pedido';

const SUBCODIGO_BUSINESS_AI = 2534037;
const CODIGO_ERROR_BUSINESS_AI = 100;
const MAX_QUICK_REPLIES = 13;
const MAX_TITULO_QUICK_REPLY = 20;
const MAX_ELEMENTOS_TEMPLATE = 10;
const MAX_LARGO_TEXTO_TEMPLATE = 80;

export interface ElementoTemplateSocial {
  title: string;
  subtitle?: string;
  image_url?: string;
  buttons?: {
    type: 'postback';
    title: string;
    payload: string;
  }[];
}

/**
 * Los textos del bot se escriben con `*negrita*` de WhatsApp; Messenger e
 * Instagram no lo interpretan y mostrarían los asteriscos tal cual.
 */
export function sinNegritasDeWhatsapp(texto: string): string {
  return texto.replace(/\*{1,2}([^*\n]+?)\*{1,2}/g, '$1');
}

export function armarTextoSocial(
  destinatarioId: string,
  texto: string,
): Record<string, unknown> {
  return {
    recipient: { id: destinatarioId },
    messaging_type: 'RESPONSE',
    message: { text: sinNegritasDeWhatsapp(texto) },
  };
}

export function armarQuickRepliesSocial(
  destinatarioId: string,
  texto: string,
  opciones: BotonRespuesta[],
  incluirTelefono?: boolean,
): Record<string, unknown> {
  const quickReplies: Record<string, unknown>[] = [];
  if (incluirTelefono) {
    quickReplies.push({ content_type: 'user_phone_number' });
  }
  for (const opt of opciones.slice(
    0,
    MAX_QUICK_REPLIES - quickReplies.length,
  )) {
    quickReplies.push({
      content_type: 'text',
      title: opt.titulo.slice(0, MAX_TITULO_QUICK_REPLY),
      payload: opt.id,
    });
  }
  return {
    recipient: { id: destinatarioId },
    messaging_type: 'RESPONSE',
    message: {
      text: sinNegritasDeWhatsapp(texto),
      quick_replies: quickReplies,
    },
  };
}

export function elementosDeTarjetas(
  productos: TarjetaProducto[],
): ElementoTemplateSocial[] {
  return productos.slice(0, MAX_ELEMENTOS_TEMPLATE).map((p) => {
    const subtitulo = p.descripcion ?? `Desde ${pesos(p.precioDesde)}`;
    const elem: ElementoTemplateSocial = {
      title: p.nombre.slice(0, MAX_LARGO_TEXTO_TEMPLATE),
      subtitle: subtitulo.slice(0, MAX_LARGO_TEXTO_TEMPLATE),
      buttons: [
        {
          type: 'postback',
          title: 'Agregar al pedido',
          payload: `pedir:${p.nombre}`,
        },
      ],
    };
    if (p.imagenUrl) {
      elem.image_url = p.imagenUrl;
    }
    return elem;
  });
}

export function armarGenericTemplateSocial(
  destinatarioId: string,
  elementos: ElementoTemplateSocial[],
): Record<string, unknown> {
  return {
    recipient: { id: destinatarioId },
    messaging_type: 'RESPONSE',
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elementos.slice(0, MAX_ELEMENTOS_TEMPLATE),
        },
      },
    },
  };
}

export function armarSenderActionSocial(
  destinatarioId: string,
  action: 'mark_seen' | 'typing_on',
): Record<string, unknown> {
  return {
    recipient: { id: destinatarioId },
    sender_action: action,
  };
}

interface ErrorMetaResponse {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
  };
}

export function esErrorBusinessAi(cuerpo: unknown): boolean {
  if (!cuerpo || typeof cuerpo !== 'object') return false;
  const error = (cuerpo as ErrorMetaResponse).error;
  return (
    error?.code === CODIGO_ERROR_BUSINESS_AI &&
    error?.error_subcode === SUBCODIGO_BUSINESS_AI
  );
}
