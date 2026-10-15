export type ItemPedido = {
  variante_id: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
};

export type ItemEdit = ItemPedido & { id: string };

export type ClientePedido = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
};

export type PedidoAdmin = {
  id: string;
  canal: 'web' | 'pos';
  cliente: ClientePedido;
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  stock_status: string;
  total: number;
  created_at: string;
  items: ItemPedido[];
};

export type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

export type Producto = {
  id: string;
  nombre: string;
  categoria_id: string;
  variantes: Variante[];
};

export type Categoria = { id: string; nombre: string; orden: number };

export function nombreDelCliente(
  c: Pick<ClientePedido, 'nombre' | 'apellido'>,
) {
  return c.nombre
    ? `${c.nombre} ${c.apellido ?? ''}`.trim()
    : 'Cliente sin nombre';
}

export function etiquetaItem(
  i: Pick<ItemPedido, 'producto_nombre' | 'variante_nombre'>,
) {
  return i.variante_nombre
    ? `${i.producto_nombre} (${i.variante_nombre})`
    : i.producto_nombre;
}
