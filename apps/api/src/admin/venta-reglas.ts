import { BadRequestException } from '@nestjs/common';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { METODOS_PAGO } from '../common/metodos-pago';
import {
  MODALIDADES_VENTA,
  type CrearVentaInput,
  type FilaClienteVenta,
  type FilaPedidoVenta,
  type ItemVentaCalculado,
  type VentaDto,
} from './pedidos-admin.tipos';

/** Datos del cliente ya recortados; lo vacío queda en null. */
export interface DatosClienteVenta {
  nombre: string;
  apellido: string | null;
  telefono: string | undefined;
  correo: string | null;
  cedula: string | null;
}

export interface CanjeDeVenta {
  puntos: number;
  descuento: number;
}

export function validarVenta(input: CrearVentaInput): void {
  if (!input.cliente?.nombre?.trim()) {
    throw new BadRequestException('Falta el nombre del cliente.');
  }
  if (!METODOS_PAGO.includes(input.metodo_pago)) {
    throw new BadRequestException('Método de pago inválido.');
  }
  if (!MODALIDADES_VENTA.includes(input.modalidad)) {
    throw new BadRequestException('Modalidad inválida.');
  }
  if (input.modalidad === 'domicilio' && !input.direccion_entrega?.trim()) {
    throw new BadRequestException('Falta la dirección de entrega.');
  }
}

/** El domicilio se cobra solo en esa modalidad; sin costo manual, el default. */
export function costoDomicilioDeVenta(input: CrearVentaInput): number {
  if (input.modalidad !== 'domicilio') return 0;
  const costo = input.costo_domicilio ?? COSTO_DOMICILIO_DEFAULT;
  if (costo < 0) {
    throw new BadRequestException(
      'El costo de domicilio no puede ser negativo.',
    );
  }
  return costo;
}

export function datosClienteDeVenta(
  cliente: CrearVentaInput['cliente'],
): DatosClienteVenta {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido?.trim() || null,
    telefono: cliente.telefono?.trim(),
    correo: cliente.correo?.trim() || null,
    cedula: cliente.cedula?.trim() || null,
  };
}

/** La respuesta de `POST /admin/ventas`: pedido, cliente, líneas y puntos. */
export function armarVentaDto(datos: {
  pedido: FilaPedidoVenta;
  cliente: FilaClienteVenta;
  items: ItemVentaCalculado[];
  canje: CanjeDeVenta;
  puntosGanados: number;
}): VentaDto {
  const { pedido, cliente, items, canje, puntosGanados } = datos;
  return {
    id: pedido.id,
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo,
      cedula: cliente.cedula,
    },
    modalidad: pedido.modalidad,
    direccion_entrega: pedido.direccion_entrega,
    costo_domicilio: pedido.costo_domicilio,
    metodo_pago: pedido.metodo_pago,
    total: pedido.total,
    created_at: pedido.created_at,
    items: items.map((i) => ({
      producto_nombre: i.producto_nombre,
      variante_nombre: i.variante_nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    })),
    puntos_canjeados: canje.puntos,
    descuento_puntos: canje.descuento,
    puntos_ganados: puntosGanados,
  };
}
