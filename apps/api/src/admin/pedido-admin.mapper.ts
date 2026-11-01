import type { FilaPedidoAdmin, PedidoAdminDto } from './pedidos-admin.tipos';

export function mapPedido(p: FilaPedidoAdmin): PedidoAdminDto {
  const cliente = p.clientes;
  return {
    id: p.id,
    canal: p.canal,
    cliente: {
      id: cliente?.id ?? '',
      nombre: cliente?.nombre ?? '',
      apellido: cliente?.apellido ?? null,
      telefono: cliente?.telefono ?? null,
      direccion: cliente?.direccion ?? null,
      correo: cliente?.correo ?? null,
    },
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
    items: (p.items_pedido ?? []).map((i) => ({
      variante_id: i.variante_id,
      producto_nombre:
        i.variantes_producto?.productos?.nombre ?? i.nombre_personalizado ?? '',
      variante_nombre: i.variantes_producto?.nombre ?? '',
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    })),
  };
}
