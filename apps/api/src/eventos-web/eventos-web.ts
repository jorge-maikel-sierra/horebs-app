import { MS_POR_SEGUNDO } from '../common/tiempo';
import {
  normalizarAtribucion,
  type ContextoHttp,
} from '../pedidos/atribucion-web';

/**
 * Eventos del navegador que también salen por la API de conversiones. El
 * Purchase no está: ya lo manda `ConversionesWebService` al entregar el
 * pedido, con datos del cliente.
 */
export const EVENTOS_WEB = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Contact',
] as const;

export type EventoWeb = (typeof EVENTOS_WEB)[number];

export interface EventoWebInput {
  event_name: EventoWeb;
  event_id: string;
  url: string;
  fbp?: string;
  fbc?: string;
  value?: number;
  content_ids?: unknown[];
}

const MONEDA = 'COP';
const MAX_CONTENT_IDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo ids de variante; lo demás se descarta en silencio (es medición). */
function idsDeContenido(ids: unknown[] | undefined): string[] {
  return (ids ?? [])
    .filter((id): id is string => typeof id === 'string' && UUID.test(id))
    .slice(0, MAX_CONTENT_IDS);
}

function datosPersonalizados(
  input: EventoWebInput,
): Record<string, unknown> | undefined {
  const ids = idsDeContenido(input.content_ids);
  if (input.value === undefined && ids.length === 0) return undefined;
  return {
    currency: MONEDA,
    ...(input.value !== undefined ? { value: input.value } : {}),
    ...(ids.length > 0 ? { content_type: 'product', content_ids: ids } : {}),
  };
}

/**
 * Copia de servidor de un evento del Pixel. `event_id` es el mismo `eventID`
 * que el Pixel recibe desde GTM: Meta se queda con uno solo (48 h). Sin
 * navegador o con una URL ajena no se manda nada: Meta exige
 * `client_user_agent` en eventos de sitio web y la URL tiene que ser del sitio.
 */
export function payloadEventoWeb(
  input: EventoWebInput,
  http: ContextoHttp,
  ahora: Date,
): Record<string, unknown> | null {
  const a = normalizarAtribucion(
    { fbp: input.fbp, fbc: input.fbc, url: input.url },
    http,
  );
  if (!a?.user_agent || !a.url) return null;
  const userData = Object.fromEntries(
    Object.entries({
      client_ip_address: a.ip,
      client_user_agent: a.user_agent,
      fbp: a.fbp,
      fbc: a.fbc,
    }).filter(([, v]) => v !== undefined),
  );
  const customData = datosPersonalizados(input);
  return {
    event_name: input.event_name,
    event_time: Math.floor(ahora.getTime() / MS_POR_SEGUNDO),
    event_id: input.event_id,
    action_source: 'website',
    event_source_url: a.url,
    user_data: userData,
    ...(customData ? { custom_data: customData } : {}),
  };
}
