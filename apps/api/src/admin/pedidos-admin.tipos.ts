/**
 * A diferencia del carrito público (calcularItems, precio 100% desde la
 * base), el POS es un mostrador operado por personal autenticado — acá
 * sí se confía en el precio que manda el cliente cuando lo manda, para
 * poder cobrar bordes, adicionales u otros ajustes puntuales.
 */
export interface ItemVentaInput {
  variante_id?: string;
  nombre_personalizado?: string;
  precio_unitario?: number;
  cantidad: number;
}

export interface ItemVentaCalculado {
  variante_id: string | null;
  nombre_personalizado: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CrearVentaInput {
  cliente: {
    nombre: string;
    apellido?: string;
    telefono?: string;
    correo?: string;
    cedula?: string;
  };
  modalidad: 'local' | 'retiro' | 'domicilio';
  direccion_entrega?: string;
  costo_domicilio?: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  notas?: string;
  items: ItemVentaInput[];
  usar_puntos?: boolean;
}

export interface VentaDto {
  id: string;
  cliente: {
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    correo: string | null;
    cedula: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  total: number;
  created_at: string;
  items: {
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
  puntos_canjeados: number;
  descuento_puntos: number;
  puntos_ganados: number;
}

export interface PedidoAdminDto {
  id: string;
  canal: string;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    direccion: string | null;
    correo: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  stock_status: string;
  total: number;
  created_at: string;
  /** Reserva del bot: hora de entrega (ISO). null = lo antes posible. */
  programado_para: string | null;
  /** El cliente mandó el comprobante de transferencia por WhatsApp. */
  tiene_comprobante: boolean;
  /** Lo que el bot o el cliente dejó escrito en el pedido (ej. pizza mitad y mitad). */
  notas: string | null;
  items: {
    variante_id: string | null;
    producto_nombre: string;
    variante_nombre: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}

export const ESTADOS_PEDIDO = [
  'pendiente',
  'confirmado',
  'en_preparacion',
  // Solo domicilio, entre el horno y la entrega — el cliente del bot recibe
  // "va en camino" por WhatsApp.
  'en_camino',
  'entregado',
  'cancelado',
];
export const MODALIDADES_VENTA = ['local', 'retiro', 'domicilio'];

export const PEDIDO_ADMIN_SELECT =
  'id, canal, modalidad, direccion_entrega, costo_domicilio, metodo_pago, estado, stock_status, total, notas, created_at, programado_para, comprobante_path, clientes(id, nombre, apellido, telefono, direccion, correo), items_pedido(variante_id, nombre_personalizado, cantidad, precio_unitario, variantes_producto(nombre, productos(nombre)))';
