import { createHash } from 'crypto';
import { MS_POR_SEGUNDO } from '../common/tiempo';
import type { AtribucionWeb } from '../pedidos/atribucion-web';

const MONEDA = 'COP';
const SITIO_URL = 'https://pizzeriahorebs.shop';
const DIGITOS_TELEFONO_COLOMBIA = 10;
// El negocio solo vende en Riohacha (Colombia): ciudad y país son fijos.
const CIUDAD = 'riohacha';
const PAIS = 'co';

export interface PedidoWebParaEvento {
  id: string;
  total: number;
  clienteId: string | null;
  cliente: {
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    correo: string | null;
  } | null;
  items: { varianteId: string; cantidad: number }[];
  atribucion: AtribucionWeb | null;
}

export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** Teléfono con indicativo de país, solo dígitos (formato que pide Meta). */
export function telefonoParaMeta(telefono: string | null): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  if (digitos.length < DIGITOS_TELEFONO_COLOMBIA) return null;
  return `57${digitos.slice(-DIGITOS_TELEFONO_COLOMBIA)}`;
}

/** Nombres en minúscula y sin signos ni espacios; las tildes se conservan. */
export function nombreParaMeta(nombre: string | null): string | null {
  const limpio = (nombre ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');
  return limpio || null;
}

function correoParaMeta(correo: string | null | undefined): string | null {
  return correo?.trim().toLowerCase() || null;
}

function hasheado(valor: string | null): string[] | undefined {
  return valor ? [sha256(valor)] : undefined;
}

/**
 * Datos del cliente para emparejar el evento con una cuenta de Meta. Lo
 * personal va con SHA-256; IP, navegador y cookies van en claro (así lo
 * pide Meta). Sin navegador no se puede: Meta exige `client_user_agent` en
 * los eventos de sitio web.
 */
export function userDataWeb(
  pedido: PedidoWebParaEvento,
): Record<string, unknown> | null {
  const a = pedido.atribucion;
  if (!a?.user_agent) return null;
  const c = pedido.cliente;
  const datos: Record<string, unknown> = {
    em: hasheado(correoParaMeta(c?.correo)),
    ph: hasheado(telefonoParaMeta(c?.telefono ?? null)),
    fn: hasheado(nombreParaMeta(c?.nombre ?? null)),
    ln: hasheado(nombreParaMeta(c?.apellido ?? null)),
    ct: hasheado(CIUDAD),
    country: hasheado(PAIS),
    external_id: hasheado(pedido.clienteId),
    client_ip_address: a.ip,
    client_user_agent: a.user_agent,
    fbp: a.fbp,
    fbc: a.fbc,
  };
  return Object.fromEntries(
    Object.entries(datos).filter(([, v]) => v !== undefined),
  );
}

/**
 * Purchase del sitio. `event_id` = id del pedido, el mismo `transaction_id`
 * que el Pixel recibe en la página de confirmación: así Meta descarta el
 * duplicado (48 h) si el navegador ya lo mandó.
 */
export function payloadPurchaseWeb(
  pedido: PedidoWebParaEvento,
  userData: Record<string, unknown>,
  ahora: Date,
): Record<string, unknown> {
  return {
    event_name: 'Purchase',
    event_time: Math.floor(ahora.getTime() / MS_POR_SEGUNDO),
    event_id: pedido.id,
    action_source: 'website',
    event_source_url: pedido.atribucion?.url ?? `${SITIO_URL}/checkout`,
    user_data: userData,
    custom_data: {
      currency: MONEDA,
      value: pedido.total,
      order_id: pedido.id,
      content_type: 'product',
      content_ids: pedido.items.map((i) => i.varianteId),
      contents: pedido.items.map((i) => ({
        id: i.varianteId,
        quantity: i.cantidad,
      })),
    },
  };
}
