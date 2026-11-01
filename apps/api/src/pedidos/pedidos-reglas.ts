import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import type { NotificacionDomicilio } from '../mail/plantilla-domicilio';
import type { CanjeCalculado } from '../clientes/puntos.service';
import type { ItemCalculado } from './calcular-items';
import type {
  CanalPedido,
  DatosPedido,
  FilaClientePedido,
  FilaItemPedido,
  FilaPedidoCompleto,
  FilaPedidoCreado,
  PedidoDto,
  PedidoItemDto,
} from './pedidos.tipos';

/**
 * Costo de domicilio fijo, no editable por el cliente: a diferencia del POS,
 * el checkout nunca confía en un valor que mande el frontend.
 */
export function costoDomicilioDeCheckout(
  modalidad: DatosPedido['modalidad'],
): number {
  return modalidad === 'domicilio' ? COSTO_DOMICILIO_DEFAULT : 0;
}

/**
 * Columnas del upsert por teléfono. No se incluyen `correo` ni `direccion`
 * cuando este pedido no los trae, para no pisar los de un pedido anterior
 * (un pedido por WhatsApp no tiene correo).
 */
export function datosClienteUpsert(
  cliente: DatosPedido['cliente'],
): Record<string, string> {
  const datos: Record<string, string> = {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    telefono: cliente.telefono,
  };
  if (cliente.correo) datos.correo = cliente.correo;
  if (cliente.direccion) datos.direccion = cliente.direccion;
  return datos;
}

export interface MontosPedido {
  clienteId: string;
  canal: CanalPedido;
  costoDomicilio: number;
  total: number;
  canje: CanjeCalculado;
}

/** La fila de `pedidos` que se inserta. */
export function payloadPedido(
  input: DatosPedido,
  montos: MontosPedido,
): Record<string, unknown> {
  return {
    cliente_id: montos.clienteId,
    modalidad: input.modalidad,
    direccion_entrega:
      input.modalidad === 'domicilio' ? input.direccion_entrega : null,
    costo_domicilio: montos.costoDomicilio,
    metodo_pago: input.metodo_pago,
    canal: montos.canal,
    ...(input.programado_para
      ? { programado_para: input.programado_para }
      : {}),
    total: montos.total,
    notas: input.notas ?? null,
    idempotency_key: input.idempotency_key ?? null,
    puntos_canjeados: montos.canje.puntos,
    descuento_puntos: montos.canje.descuento,
  };
}

export function filasItemsPedido(
  pedidoId: string,
  items: ItemCalculado[],
): object[] {
  return items.map((i) => ({
    pedido_id: pedidoId,
    variante_id: i.variante_id,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  }));
}

export function itemsParaDescuento(
  items: ItemCalculado[],
): { variante_id: string; cantidad: number }[] {
  return items.map((i) => ({
    variante_id: i.variante_id,
    cantidad: i.cantidad,
  }));
}

/** Solo un pedido a domicilio con dirección avisa al domiciliario. */
export function avisoDomicilio(
  pedido: FilaPedidoCreado,
  cliente: FilaClientePedido,
  items: ItemCalculado[],
): NotificacionDomicilio | null {
  if (pedido.modalidad !== 'domicilio' || !pedido.direccion_entrega) {
    return null;
  }
  return {
    pedidoId: pedido.id,
    clienteNombre: cliente.nombre,
    clienteTelefono: cliente.telefono,
    direccionEntrega: pedido.direccion_entrega,
    items: items.map((i) => ({
      cantidad: i.cantidad,
      nombre: `${i.producto_nombre} (${i.variante_nombre})`,
      precioUnitario: i.precio_unitario,
    })),
    costoDomicilio: pedido.costo_domicilio || null,
    metodoPago: pedido.metodo_pago,
    total: pedido.total,
    notas: pedido.notas,
  };
}

function itemDtoDeCalculado(i: ItemCalculado): PedidoItemDto {
  return {
    variante_id: i.variante_id,
    producto_nombre: i.producto_nombre,
    variante_nombre: i.variante_nombre,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  };
}

/** Las columnas del pedido que el DTO copia tal cual, venga de donde venga. */
function baseDePedido(
  pedido: FilaPedidoCreado,
): Omit<
  PedidoDto,
  | 'cliente'
  | 'items'
  | 'puntos_canjeados'
  | 'descuento_puntos'
  | 'puntos_ganados'
> {
  return {
    id: pedido.id,
    modalidad: pedido.modalidad,
    direccion_entrega: pedido.direccion_entrega,
    costo_domicilio: pedido.costo_domicilio,
    metodo_pago: pedido.metodo_pago,
    estado: pedido.estado,
    total: pedido.total,
    notas: pedido.notas,
    created_at: pedido.created_at,
  };
}

export interface PedidoRegistrado {
  pedido: FilaPedidoCreado;
  cliente: FilaClientePedido;
  items: ItemCalculado[];
  canje: CanjeCalculado;
  puntosGanados: number;
}

/** El DTO del pedido recién creado en el checkout. */
export function armarPedidoDto(registrado: PedidoRegistrado): PedidoDto {
  const { pedido, cliente, items, canje, puntosGanados } = registrado;
  return {
    ...baseDePedido(pedido),
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo,
      direccion: cliente.direccion,
    },
    items: items.map(itemDtoDeCalculado),
    puntos_canjeados: canje.puntos,
    descuento_puntos: canje.descuento,
    puntos_ganados: puntosGanados,
  };
}

function clienteDeFila(
  cliente: FilaPedidoCompleto['clientes'],
): PedidoDto['cliente'] {
  return {
    nombre: cliente?.nombre ?? '',
    apellido: cliente?.apellido ?? null,
    telefono: cliente?.telefono ?? '',
    correo: cliente?.correo ?? null,
    direccion: cliente?.direccion ?? null,
  };
}

function itemDeFila(i: FilaItemPedido): PedidoItemDto {
  return {
    variante_id: i.variante_id,
    producto_nombre: i.variantes_producto?.productos?.nombre ?? '',
    variante_nombre: i.variantes_producto?.nombre ?? '',
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  };
}

/** El DTO de un pedido leído de la base: lo que falte en un join queda vacío. */
export function mapPedido(fila: FilaPedidoCompleto): PedidoDto {
  return {
    ...baseDePedido(fila),
    cliente: clienteDeFila(fila.clientes),
    items: (fila.items_pedido ?? []).map(itemDeFila),
    puntos_canjeados: fila.puntos_canjeados,
    descuento_puntos: fila.descuento_puntos,
    puntos_ganados: fila.puntos_ganados,
  };
}
