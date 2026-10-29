import type { PedidoAdminDto } from './pedidos-admin.tipos';

export function mapPedido(p: any): PedidoAdminDto {
  const reserva = p as {
    programado_para?: string | null;
    comprobante_path?: string | null;
    notas?: string | null;
  };
  const cliente = p.clientes;
  const items = (p.items_pedido ?? []) as any[];
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
    notas: reserva.notas ?? null,
    created_at: p.created_at,
    programado_para: reserva.programado_para ?? null,
    tiene_comprobante: Boolean(reserva.comprobante_path),
    items: items.map((i) => ({
      variante_id: i.variante_id,
      producto_nombre:
        i.variantes_producto?.productos?.nombre ?? i.nombre_personalizado ?? '',
      variante_nombre: i.variantes_producto?.nombre ?? '',
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    })),
  };
}
