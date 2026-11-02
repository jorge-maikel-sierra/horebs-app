import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { finDiaBogota, inicioDiaBogota } from '../common/horario';
import { limiteDeMovimientos, mapMovimiento } from './movimientos-reglas';
import {
  MOVIMIENTO_SELECT,
  type FilaMovimiento,
  type FiltrosMovimientos,
  type MovimientoDto,
} from './movimientos.tipos';

export type * from './movimientos.tipos';
export { MAX_LIMITE } from './movimientos.tipos';

/**
 * Solo lectura del ledger que ya escriben aplicar_movimientos_stock() y
 * procesar_detalle_compra() — antes existía en la base pero no había
 * ninguna pantalla ni endpoint para verlo.
 */
@Injectable()
export class MovimientosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(filtros: FiltrosMovimientos): Promise<MovimientoDto[]> {
    let query = this.supabase
      .getClient()
      .from('movimientos_inventario')
      .select(MOVIMIENTO_SELECT)
      .order('created_at', { ascending: false })
      .limit(limiteDeMovimientos(filtros.limit));

    if (filtros.insumoId) query = query.eq('insumo_id', filtros.insumoId);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros.desde)
      query = query.gte('created_at', inicioDiaBogota(filtros.desde));
    if (filtros.hasta)
      query = query.lte('created_at', finDiaBogota(filtros.hasta));

    const { data, error } = await query.returns<FilaMovimiento[]>();
    if (error) throw errorDeBase(error);
    return (data ?? []).map(mapMovimiento);
  }
}
