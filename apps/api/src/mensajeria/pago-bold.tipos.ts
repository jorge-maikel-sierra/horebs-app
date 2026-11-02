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
}
