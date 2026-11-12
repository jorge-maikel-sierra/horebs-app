import { createHash } from 'crypto';
import { MS_POR_SEGUNDO } from '../common/tiempo';

const MONEDA = 'COP';
// Un uuid son 32 dígitos hex agrupados 8-4-4-4-12.
const LARGO_UUID_HEX = 32;
const FORMA_UUID = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/;

/** Eventos del embudo que viven dentro del chat (FAQ de Meta, business messaging). */
export type EventoConversacion =
  'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'LeadSubmitted';

export type EventoPedido = 'OrderCreated' | 'Purchase' | 'OrderCanceled';

export type EventoSocial = EventoConversacion | EventoPedido;

export type CanalSocial = 'messenger' | 'instagram';

export interface CuentasSocial {
  pageId?: string;
  instagramId?: string;
}

export function esCanalSocial(canal: string): canal is CanalSocial {
  return canal === 'messenger' || canal === 'instagram';
}

/** Fecha del día en Bogotá (YYYY-MM-DD): el negocio opera en UTC-5. */
export function diaBogota(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(fecha);
}

/**
 * Clave de idempotencia para eventos de conversación: uno por cliente, canal
 * y día de Bogotá. Así un cliente que vuelve otro día cuenta de nuevo, pero
 * diez vistas del menú en la misma tarde cuentan una sola vez. Es un uuid
 * determinístico porque `eventos_meta_enviados.referencia_id` es uuid.
 */
export function claveDiaria(
  canal: CanalSocial,
  identificadorExterno: string,
  fecha: Date,
): string {
  const hash = createHash('sha256')
    .update(`${canal}:${identificadorExterno}:${diaBogota(fecha)}`)
    .digest('hex');
  return hash.slice(0, LARGO_UUID_HEX).replace(FORMA_UUID, '$1-$2-$3-$4-$5');
}

/**
 * Identifica al cliente como lo pide Meta para cada canal: página + PSID en
 * Messenger, cuenta de Instagram + IGSID en Instagram. Null si falta la
 * cuenta del negocio en la configuración.
 */
export function userDataSocial(
  canal: CanalSocial,
  identificadorExterno: string,
  cuentas: CuentasSocial,
): Record<string, string> | null {
  if (canal === 'messenger') {
    return cuentas.pageId
      ? { page_id: cuentas.pageId, page_scoped_user_id: identificadorExterno }
      : null;
  }
  return cuentas.instagramId
    ? {
        instagram_business_account_id: cuentas.instagramId,
        ig_sid: identificadorExterno,
      }
    : null;
}

export function payloadEventoSocial(datos: {
  evento: EventoSocial;
  canal: CanalSocial;
  userData: Record<string, string>;
  ahora: Date;
  valor?: number;
}): Record<string, unknown> {
  const evento: Record<string, unknown> = {
    event_name: datos.evento,
    event_time: Math.floor(datos.ahora.getTime() / MS_POR_SEGUNDO),
    action_source: 'business_messaging',
    messaging_channel: datos.canal,
    user_data: datos.userData,
  };
  if (datos.valor !== undefined) {
    evento.custom_data = { currency: MONEDA, value: datos.valor };
  }
  return evento;
}
