import type { FilaPedidoAdmin, PedidoAdminDto } from './pedidos-admin.tipos';

type FilaCliente = NonNullable<FilaPedidoAdmin['clientes']>;
type FilaItem = NonNullable<FilaPedidoAdmin['items_pedido']>[number];

function clienteDeFila(
  cliente: FilaPedidoAdmin['clientes'],
): PedidoAdminDto['cliente'] {
  const c: Partial<FilaCliente> = cliente ?? {};
  return {
    id: c.id ?? '',
    nombre: c.nombre ?? '',
    apellido: c.apellido ?? null,
    telefono: c.telefono ?? null,
    direccion: c.direccion ?? null,
    correo: c.correo ?? null,
  };
}

function itemDeFila(i: FilaItem): PedidoAdminDto['items'][number] {
  return {
    variante_id: i.variante_id,
    producto_nombre:
      i.variantes_producto?.productos?.nombre ?? i.nombre_personalizado ?? '',
    variante_nombre: i.variantes_producto?.nombre ?? '',
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
  };
}

export function mapPedido(p: FilaPedidoAdmin): PedidoAdminDto {
  return {
    id: p.id,
    canal: p.canal,
    cliente: clienteDeFila(p.clientes),
    modalidad: p.modalidad,
    direccion_entrega: p.direccion_entrega,
    costo_domicilio: p.costo_domicilio,
    metodo_pago: p.metodo_pago,
    estado: p.estado,
    stock_status: p.stock_status,
    total: p.total,
    notas: p.notas ?? null,
    created_at: p.created_at,
    programado_para: p.programado_para ?? null,
    tiene_comprobante: Boolean(p.comprobante_path),
    items: (p.items_pedido ?? []).map(itemDeFila),
  };
}
