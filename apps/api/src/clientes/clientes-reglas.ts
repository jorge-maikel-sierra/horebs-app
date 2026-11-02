import { BadRequestException } from '@nestjs/common';
import type {
  ClienteDetalleDto,
  EditarClienteInput,
  FilaClienteDetalle,
  FilaItemPedidoCliente,
  FilaPedidoCliente,
  FilaPedidoResumen,
  PedidoClienteDto,
} from './clientes.tipos';

/** Texto del typeahead sin los caracteres que rompen el filtro `.or(...)` de PostgREST. */
export function textoDeBusqueda(query: string): string {
  return query.trim().replace(/[,()%]/g, '');
}

/** El filtro `.or(...)` del typeahead: nombre, apellido o teléfono. */
export function filtroDeBusqueda(texto: string): string {
  return `nombre.ilike.%${texto}%,apellido.ilike.%${texto}%,telefono.ilike.%${texto}%`;
}

export function validarEdicionCliente(cambios: EditarClienteInput): void {
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    throw new BadRequestException('El nombre no puede quedar vacío.');
  }
}

/** Un texto en blanco se guarda como null (así se borra un dato); ausente no se toca. */
function borrable(valor: string | undefined): string | null | undefined {
  return valor === undefined ? undefined : valor.trim() || null;
}

/**
 * Solo las columnas que el cambio trae. El nombre se recorta; el resto, si
 * queda en blanco, se guarda como null.
 */
export function cambiosDeCliente(
  cambios: EditarClienteInput,
): Record<string, string | null> {
  const columnas: Record<string, string | null | undefined> = {
    nombre: cambios.nombre?.trim(),
    apellido: borrable(cambios.apellido),
    telefono: borrable(cambios.telefono),
    direccion: borrable(cambios.direccion),
    correo: borrable(cambios.correo),
    cedula: borrable(cambios.cedula),
  };
  return Object.fromEntries(
    Object.entries(columnas).filter(
      (entrada): entrada is [string, string | null] => entrada[1] !== undefined,
    ),
  );
}

/** El historial de pedidos pesa solo lo que vale: cantidad, suma y el más reciente. */
export function detalleConPedidos(
  cliente: FilaClienteDetalle,
  pedidos: FilaPedidoResumen[],
): ClienteDetalleDto {
  return {
    ...cliente,
    total_pedidos: pedidos.length,
    total_gastado: pedidos.reduce((acc, p) => acc + p.total, 0),
    ultimo_pedido: pedidos[0]?.created_at ?? null,
  };
}

/** "Pizza (Grande)"; sin variante solo el producto; sin producto, el nombre personalizado. */
export function nombreDeItem(item: FilaItemPedidoCliente): string {
  const producto = item.variantes_producto?.productos?.nombre;
  if (!producto) return item.nombre_personalizado ?? 'Producto';
  const variante = item.variantes_producto?.nombre;
  return variante ? `${producto} (${variante})` : producto;
}

export function mapPedidoCliente(fila: FilaPedidoCliente): PedidoClienteDto {
  return {
    id: fila.id,
    canal: fila.canal,
    modalidad: fila.modalidad,
    metodo_pago: fila.metodo_pago,
    estado: fila.estado,
    total: fila.total,
    costo_domicilio: fila.costo_domicilio,
    created_at: fila.created_at,
    items: (fila.items_pedido ?? []).map((i) => ({
      nombre: nombreDeItem(i),
      cantidad: i.cantidad,
    })),
  };
}
