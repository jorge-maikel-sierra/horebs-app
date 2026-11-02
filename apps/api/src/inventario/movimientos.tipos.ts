export interface MovimientoDto {
  id: string;
  insumo_id: string;
  insumo_nombre: string;
  unidad_medida: string;
  tipo: string;
  cantidad_g: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
}

export interface FiltrosMovimientos {
  insumoId?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}

export interface FilaMovimiento {
  id: string;
  insumo_id: string;
  tipo: string;
  cantidad_g: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
  insumos: { nombre: string; unidad_medida: string } | null;
}

export const MOVIMIENTO_SELECT =
  'id, insumo_id, tipo, cantidad_g, referencia_tipo, referencia_id, motivo, created_at, insumos(nombre, unidad_medida)';

export const MAX_LIMITE = 200;
export const LIMITE_POR_DEFECTO = 100;
