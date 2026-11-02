export interface ClienteDto {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
}

export interface ClienteDetalleDto extends ClienteDto {
  created_at: string;
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
}

export interface PedidoClienteDto {
  id: string;
  canal: string;
  modalidad: string;
  metodo_pago: string;
  estado: string;
  total: number;
  costo_domicilio: number;
  created_at: string;
  /** Una línea por producto: "Pizza Hawaiana (Grande)" × cantidad. */
  items: { nombre: string; cantidad: number }[];
}

export interface EditarClienteInput {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  correo?: string;
  cedula?: string;
}

export type FilaCliente = ClienteDto;

/** El cliente tal como sale de la base, antes de sumarle sus pedidos. */
export interface FilaClienteDetalle extends ClienteDto {
  created_at: string;
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
}

export interface FilaPedidoResumen {
  total: number;
  created_at: string;
}

export interface FilaItemPedidoCliente {
  nombre_personalizado: string | null;
  cantidad: number;
  variantes_producto: {
    nombre: string;
    productos: { nombre: string } | null;
  } | null;
}

export interface FilaPedidoCliente {
  id: string;
  canal: string;
  modalidad: string;
  metodo_pago: string;
  estado: string;
  total: number;
  costo_domicilio: number;
  created_at: string;
  items_pedido: FilaItemPedidoCliente[] | null;
}

export const SELECT_CLIENTE =
  'id, nombre, apellido, telefono, direccion, correo, cedula';

export const SELECT_CLIENTE_DETALLE = `${SELECT_CLIENTE}, created_at, puntos_actuales, puntos_ultima_actividad`;

export const SELECT_PEDIDO_CLIENTE =
  'id, canal, modalidad, metodo_pago, estado, total, costo_domicilio, created_at, items_pedido(nombre_personalizado, cantidad, variantes_producto(nombre, productos(nombre)))';

// Tope de seguridad: el total real sale de obtenerDetalle, esto es solo el historial.
export const MAX_PEDIDOS_CLIENTE = 200;
export const LIMITE_BUSQUEDA = 10;
export const LIMITE_LISTADO = 100;
