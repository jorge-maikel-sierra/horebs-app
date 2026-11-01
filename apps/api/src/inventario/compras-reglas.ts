import { BadRequestException } from '@nestjs/common';
import { METODOS_PAGO } from '../common/metodos-pago';
import type {
  CompraDto,
  CrearCompraInput,
  DetalleCompraInput,
  FilaCompra,
} from './compras.tipos';

const UNIDADES = ['kg', 'g', 'unidad'];

function validarLinea(linea: DetalleCompraInput): void {
  if (!linea.producto_comprado?.trim()) {
    throw new BadRequestException('Falta la descripción de una línea.');
  }
  if (typeof linea.cantidad !== 'number' || linea.cantidad <= 0) {
    throw new BadRequestException('Cantidad inválida en una línea.');
  }
  if (!UNIDADES.includes(linea.unidad_medida_compra)) {
    throw new BadRequestException('Unidad de medida inválida en una línea.');
  }
  if (typeof linea.valor_unitario !== 'number' || linea.valor_unitario < 0) {
    throw new BadRequestException('Valor unitario inválido en una línea.');
  }
}

export function validarCompra(input: CrearCompraInput): void {
  if (!input.proveedor?.trim()) {
    throw new BadRequestException('Falta el proveedor.');
  }
  if (!input.fecha) {
    throw new BadRequestException('Falta la fecha de la compra.');
  }
  if (!METODOS_PAGO.includes(input.metodo_pago)) {
    throw new BadRequestException('Método de pago inválido.');
  }
  if (!Array.isArray(input.detalle) || input.detalle.length === 0) {
    throw new BadRequestException('La factura no tiene líneas.');
  }
  input.detalle.forEach(validarLinea);
}

/**
 * El subtotal nunca se toma del cliente: se recalcula desde las líneas,
 * mismo criterio que `calcularItems` del checkout público.
 */
export function subtotalDeCompra(detalle: DetalleCompraInput[]): number {
  return detalle.reduce(
    (acc, linea) => acc + linea.cantidad * linea.valor_unitario,
    0,
  );
}

/** Parámetros de la RPC `crear_compra_con_detalle`. */
export function paramsCrearCompra(
  input: CrearCompraInput,
  subtotal: number,
  registradoPor: string,
): Record<string, unknown> {
  return {
    p_numero_factura: input.numero_factura?.trim() || null,
    p_proveedor: input.proveedor.trim(),
    p_fecha: input.fecha,
    p_subtotal: subtotal,
    p_otros_cargos: input.otros_cargos ?? 0,
    p_metodo_pago: input.metodo_pago,
    p_categoria: input.categoria?.trim() || null,
    p_registrado_por: registradoPor,
    p_detalle: input.detalle.map((linea) => ({
      insumo_id: linea.insumo_id ?? '',
      producto_comprado: linea.producto_comprado.trim(),
      cantidad: linea.cantidad,
      unidad_medida_compra: linea.unidad_medida_compra,
      valor_unitario: linea.valor_unitario,
    })),
  };
}

export type ClaseErrorProcesado = 'no_existe' | 'de_negocio' | 'otro';

/**
 * Los mensajes que arma `procesar_detalle_compra()` para una línea que no
 * existe, no está pendiente o no tiene insumo son de negocio y seguros de
 * mostrar. Cualquier otro error de Postgres (constraint, tipo, conexión) no
 * se expone crudo al cliente.
 */
export function clasificarErrorProcesado(
  mensaje: string | undefined,
): ClaseErrorProcesado {
  if (mensaje?.includes('no existe')) return 'no_existe';
  if (
    mensaje?.includes('no está pendiente') ||
    mensaje?.includes('no tiene insumo asignado')
  ) {
    return 'de_negocio';
  }
  return 'otro';
}

export function mapCompra(c: FilaCompra): CompraDto {
  return {
    id: c.id,
    numero_factura: c.numero_factura,
    proveedor: c.proveedor,
    fecha: c.fecha,
    subtotal: c.subtotal,
    otros_cargos: c.otros_cargos,
    metodo_pago: c.metodo_pago,
    categoria: c.categoria,
    created_at: c.created_at,
    detalle: (c.detalle_compra ?? []).map((d) => ({
      id: d.id,
      insumo_id: d.insumo_id,
      insumo_nombre: d.insumos?.nombre ?? null,
      producto_comprado: d.producto_comprado,
      cantidad: d.cantidad,
      unidad_medida_compra: d.unidad_medida_compra,
      valor_unitario: d.valor_unitario,
      total_linea: d.total_linea,
      estado_procesado: d.estado_procesado,
      fecha_procesado: d.fecha_procesado,
    })),
  };
}
