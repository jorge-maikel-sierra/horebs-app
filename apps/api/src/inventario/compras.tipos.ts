import type { MetodoPago } from '../common/metodos-pago';

export type UnidadCompra = 'kg' | 'g' | 'unidad';
export type EstadoLinea = 'pendiente' | 'procesado' | 'excluido';

export interface DetalleCompraInput {
  insumo_id?: string;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: UnidadCompra;
  valor_unitario: number;
}

export interface CrearCompraInput {
  numero_factura?: string;
  proveedor: string;
  fecha: string;
  otros_cargos?: number;
  metodo_pago: MetodoPago;
  categoria?: string;
  detalle: DetalleCompraInput[];
}

export interface ActualizarLineaInput {
  estado?: 'procesado' | 'excluido';
  insumo_id?: string;
}

export interface DetalleCompraDto {
  id: string;
  insumo_id: string | null;
  insumo_nombre: string | null;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: UnidadCompra;
  valor_unitario: number;
  total_linea: number;
  estado_procesado: EstadoLinea;
  fecha_procesado: string | null;
}

export interface CompraDto {
  id: string;
  numero_factura: string | null;
  proveedor: string;
  fecha: string;
  subtotal: number;
  otros_cargos: number;
  metodo_pago: string;
  categoria: string | null;
  created_at: string;
  detalle: DetalleCompraDto[];
}

/** Una línea tal como la devuelve `COMPRA_SELECT`. */
export interface FilaDetalleCompra {
  id: string;
  insumo_id: string | null;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: UnidadCompra;
  valor_unitario: number;
  total_linea: number;
  estado_procesado: EstadoLinea;
  fecha_procesado: string | null;
  insumos: { nombre: string } | null;
}

/** Una compra tal como la devuelve `COMPRA_SELECT`. */
export interface FilaCompra {
  id: string;
  numero_factura: string | null;
  proveedor: string;
  fecha: string;
  subtotal: number;
  otros_cargos: number;
  metodo_pago: string;
  categoria: string | null;
  created_at: string;
  detalle_compra: FilaDetalleCompra[] | null;
}

export const COMPRA_SELECT =
  'id, numero_factura, proveedor, fecha, subtotal, otros_cargos, metodo_pago, categoria, created_at, detalle_compra(id, insumo_id, producto_comprado, cantidad, unidad_medida_compra, valor_unitario, total_linea, estado_procesado, fecha_procesado, insumos(nombre))';
