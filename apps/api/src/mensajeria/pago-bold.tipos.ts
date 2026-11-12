import type { CanalMensajeria } from './conversaciones.tipos';

/** Estado del cobro de un pedido (`pedidos.pago_estado`). */
export type PagoEstado =
  'no_aplica' | 'pendiente' | 'pagado' | 'rechazado' | 'vencido';

/** Lo que usamos del evento que Bold manda al webhook. */
export interface EventoBold {
  id?: string;
  type?: string;
  data?: {
    payment_id?: string;
    metadata?: { reference?: string };
  };
}

export interface PedidoCobrado {
  id: string;
  total: number;
  clientes: { nombre: string; telefono: string } | null;
  /** Conversación del bot de la que salió el pedido (null en la web o en pedidos viejos). */
  conversaciones_bot: {
    canal: CanalMensajeria;
    identificador_externo: string;
  } | null;
}

const PREFIJO_WHATSAPP_CO = '57';

/**
 * Por dónde avisarle al cliente que su pago pasó o no: por el mismo chat en
 * que pidió (Messenger, Instagram o WhatsApp). Sin conversación ligada, por
 * WhatsApp al teléfono del pedido, como antes.
 */
export function destinoAvisoPago(
  pedido: PedidoCobrado,
): { canal: CanalMensajeria; identificadorExterno: string } | null {
  const conversacion = pedido.conversaciones_bot;
  if (conversacion) {
    return {
      canal: conversacion.canal,
      identificadorExterno: conversacion.identificador_externo,
    };
  }
  const telefono = pedido.clientes?.telefono;
  return telefono
    ? {
        canal: 'whatsapp',
        identificadorExterno: `${PREFIJO_WHATSAPP_CO}${telefono}`,
      }
    : null;
}
