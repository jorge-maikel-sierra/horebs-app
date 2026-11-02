export interface InsumoAlertaDto {
  id: string;
  nombre: string;
  unidad_medida: string;
  stock_actual_g: number;
  stock_minimo_g: number;
}

export interface ReporteInventarioDto {
  valorizacionTotal: number;
  insumosStockNegativo: InsumoAlertaDto[];
  insumosStockBajo: InsumoAlertaDto[];
  gastoComprasMesActual: number;
  gastoComprasMesAnterior: number;
  recetasSinCostear: number;
}

export interface FilaInsumoReporte extends InsumoAlertaDto {
  costo_unitario_g: number;
}

export interface FilaGastoCompra {
  subtotal: number;
  otros_cargos: number;
}

export interface RangoMeses {
  inicioMesActual: string;
  inicioMesAnterior: string;
}

export const INSUMO_REPORTE_SELECT =
  'id, nombre, unidad_medida, stock_actual_g, stock_minimo_g, costo_unitario_g';
