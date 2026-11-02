import {
  LIMITE_POR_DEFECTO,
  MAX_LIMITE,
  type FilaMovimiento,
  type MovimientoDto,
} from './movimientos.tipos';

export function limiteDeMovimientos(limit: number | undefined): number {
  return Math.min(limit ?? LIMITE_POR_DEFECTO, MAX_LIMITE);
}

/** Un insumo borrado deja el movimiento sin join: se muestra con valores neutros. */
export function mapMovimiento(fila: FilaMovimiento): MovimientoDto {
  return {
    id: fila.id,
    insumo_id: fila.insumo_id,
    insumo_nombre: fila.insumos?.nombre ?? '(insumo eliminado)',
    unidad_medida: fila.insumos?.unidad_medida ?? 'g',
    tipo: fila.tipo,
    cantidad_g: fila.cantidad_g,
    referencia_tipo: fila.referencia_tipo,
    referencia_id: fila.referencia_id,
    motivo: fila.motivo,
    created_at: fila.created_at,
  };
}
