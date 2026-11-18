import { MS_POR_DIA, MS_POR_SEGUNDO } from '../common/tiempo';
import type { OrigenVenta } from '../admin/pedidos-admin.tipos';
import {
  nombreParaMeta,
  sha256,
  telefonoParaMeta,
  ubicacionParaMeta,
} from './conversiones-web';

const MONEDA = 'COP';
const PAIS = 'co';
// Meta rechaza eventos viejos: 7 días en general y 62 los de tienda física.
const DIAS_MAX_EVENTO = 7;
const DIAS_MAX_TIENDA_FISICA = 62;

export type ActionSourceCaja = 'physical_store' | 'phone_call' | 'chat';

export interface VentaCajaParaEvento {
  pedidoId: string;
  total: number;
  modalidad: string;
  origen: OrigenVenta | null;
  creadoEn: Date;
  cliente: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    correo: string | null;
    ciudad?: string | null;
    departamento?: string | null;
  };
  items: { varianteId: string | null; cantidad: number }[];
}

/**
 * Cómo se cerró la venta según Meta: en el local, por llamada o por chat. Sin
 * origen (ventas anteriores al selector) se deduce de la modalidad: quien come
 * o recoge está en el local y el domicilio se pide a distancia.
 */
export function actionSourceDeVenta(
  origen: OrigenVenta | null,
  modalidad: string,
): ActionSourceCaja {
  if (origen === 'mostrador') return 'physical_store';
  if (origen === 'llamada') return 'phone_call';
  if (origen) return 'chat';
  return modalidad === 'domicilio' ? 'phone_call' : 'physical_store';
}

/** Meta pide los datos personales con SHA-256: sin teléfono ni correo no hay con qué emparejar. */
export function userDataCaja(
  cliente: VentaCajaParaEvento['cliente'],
): Record<string, unknown> | null {
  const telefono = telefonoParaMeta(cliente.telefono);
  const correo = cliente.correo?.trim().toLowerCase() || null;
  if (!telefono && !correo) return null;
  const hashear = (v: string | null): string[] | undefined =>
    v ? [sha256(v)] : undefined;
  const datos: Record<string, unknown> = {
    ph: hashear(telefono),
    em: hashear(correo),
    fn: hashear(nombreParaMeta(cliente.nombre)),
    ln: hashear(nombreParaMeta(cliente.apellido)),
    ...ubicacionParaMeta(cliente),
    country: hashear(PAIS),
    external_id: hashear(cliente.id),
  };
  return Object.fromEntries(
    Object.entries(datos).filter(([, v]) => v !== undefined),
  );
}

/** ¿Meta todavía acepta un evento de esa fecha? Sirve para cargar el histórico sin que lo rechace. */
export function eventoVigente(
  actionSource: ActionSourceCaja,
  creadoEn: Date,
  ahora: Date,
): boolean {
  const dias =
    actionSource === 'physical_store'
      ? DIAS_MAX_TIENDA_FISICA
      : DIAS_MAX_EVENTO;
  return ahora.getTime() - creadoEn.getTime() < dias * MS_POR_DIA;
}

/**
 * Purchase de una venta de caja. `event_id` es el id del pedido y la hora es
 * la de la venta, no la del envío: así el histórico cae en su fecha real.
 */
export function payloadPurchaseCaja(
  venta: VentaCajaParaEvento,
  userData: Record<string, unknown>,
): Record<string, unknown> {
  const variantes = venta.items.filter(
    (i): i is { varianteId: string; cantidad: number } => i.varianteId !== null,
  );
  return {
    event_name: 'Purchase',
    event_time: Math.floor(venta.creadoEn.getTime() / MS_POR_SEGUNDO),
    event_id: venta.pedidoId,
    action_source: actionSourceDeVenta(venta.origen, venta.modalidad),
    user_data: userData,
    custom_data: {
      currency: MONEDA,
      value: venta.total,
      order_id: venta.pedidoId,
      content_type: 'product',
      content_ids: variantes.map((i) => i.varianteId),
      contents: variantes.map((i) => ({
        id: i.varianteId,
        quantity: i.cantidad,
      })),
    },
  };
}
