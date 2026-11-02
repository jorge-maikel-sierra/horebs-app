export type UnidadMedida = 'g' | 'ml' | 'unidad';

export const UNIDADES_MEDIDA: UnidadMedida[] = ['g', 'ml', 'unidad'];

export interface InsumoDto {
  id: string;
  nombre: string;
  categoria: string;
  unidad_medida: UnidadMedida;
  stock_actual_g: number;
  stock_minimo_g: number;
  costo_unitario_g: number;
  proveedor_principal: string | null;
  fecha_ultima_compra: string | null;
  activo: boolean;
}

export interface CrearInsumoInput {
  nombre: string;
  categoria: string;
  unidad_medida?: UnidadMedida;
  stock_minimo_g?: number;
  proveedor_principal?: string;
}

export interface EditarInsumoInput {
  nombre?: string;
  categoria?: string;
  unidad_medida?: UnidadMedida;
  stock_minimo_g?: number;
  proveedor_principal?: string;
  activo?: boolean;
}

export type TipoAjusteStock = 'ajuste' | 'merma';

export interface AjusteStockInput {
  tipo: TipoAjusteStock;
  cantidad_g: number;
  motivo: string;
}

/** Las columnas de `insumos` que se leen para decidir si avisar de stock bajo. */
export interface FilaStockInsumo {
  id: string;
  nombre: string;
  unidad_medida: string;
  stock_actual_g: number;
  stock_minimo_g: number;
  alerta_stock_enviada_en: string | null;
}

export interface AlertaStockBajo {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
}

export interface AlertasPorEnviar {
  paraAlertar: AlertaStockBajo[];
  paraResetear: string[];
}

export const INSUMO_SELECT =
  'id, nombre, categoria, unidad_medida, stock_actual_g, stock_minimo_g, costo_unitario_g, proveedor_principal, fecha_ultima_compra, activo';

export const STOCK_ALERTA_SELECT =
  'id, nombre, unidad_medida, stock_actual_g, stock_minimo_g, alerta_stock_enviada_en';
