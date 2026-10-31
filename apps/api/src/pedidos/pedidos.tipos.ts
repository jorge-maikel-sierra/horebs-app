export interface CrearPedidoItemInput {
  variante_id: string;
  cantidad: number;
}

export interface CrearPedidoInput {
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    correo: string;
    direccion?: string;
  };
  modalidad: 'domicilio' | 'retiro';
  direccion_entrega?: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: CrearPedidoItemInput[];
  usar_puntos?: boolean;
  /**
   * El frontend genera un UUID una sola vez por intento de checkout (no
   * por click) y lo reenvía tal cual en reintentos de red o si el mismo
   * submit dispara dos requests casi simultáneos (doble clic más rápido
   * que el disabled del botón). Con la columna `idempotency_key` (unique)
   * de `pedidos`, el segundo insert choca contra la restricción en vez de
   * crear un pedido duplicado con el stock descontado dos veces.
   */
  idempotency_key?: string;
}

/**
 * Pedido armado por el bot de WhatsApp: el cliente no tiene por qué dar un
 * correo (lo identifica su teléfono) y puede pedir para comer en el local.
 */
export interface CrearPedidoWhatsappInput extends Omit<
  CrearPedidoInput,
  'cliente' | 'modalidad'
> {
  cliente: {
    nombre: string;
    apellido: string;
    telefono: string;
    direccion?: string;
  };
  modalidad: 'domicilio' | 'retiro' | 'local';
  /** Reserva: hora de entrega (ISO). null/ausente = lo antes posible. */
  programado_para?: string | null;
}

export type CanalPedido = 'web' | 'whatsapp';

/** Lo común a las dos entradas — el correo solo lo exige la web. */
export type DatosPedido = Omit<CrearPedidoInput, 'cliente' | 'modalidad'> & {
  cliente: CrearPedidoWhatsappInput['cliente'] & { correo?: string };
  modalidad: CrearPedidoWhatsappInput['modalidad'];
  programado_para?: string | null;
};

export interface ClienteBotDto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  direccion: string | null;
  puntosActuales: number;
}

export interface PedidoParaAvisoDto {
  id: string;
  canal: string;
  estado: string;
  modalidad: string;
  direccionEntrega: string | null;
  /** Teléfono local del cliente (3187592616), sin el 57. */
  telefono: string | null;
  /** Solo en pedidosParaRecompra: puntos de este pedido y saldo actual. */
  puntosGanados?: number;
  puntosActuales?: number;
}

export interface UltimoPedidoDto {
  items: { varianteId: string; cantidad: number }[];
  direccionEntrega: string | null;
}

export interface PedidoItemDto {
  variante_id: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PedidoDto {
  id: string;
  cliente: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    correo: string | null;
    direccion: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  total: number;
  notas: string | null;
  created_at: string;
  items: PedidoItemDto[];
  puntos_canjeados: number;
  descuento_puntos: number;
  puntos_ganados: number;
}

export interface PedidoResumenDto {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  items: {
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
  }[];
}
