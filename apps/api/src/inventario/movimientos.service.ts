import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

const MOVIMIENTO_SELECT =
  'id, insumo_id, tipo, cantidad_g, referencia_tipo, referencia_id, motivo, created_at, insumos(nombre, unidad_medida)';

const MAX_LIMITE = 200;

/**
 * Solo lectura del ledger que ya escriben aplicar_movimientos_stock() y
 * procesar_detalle_compra() — antes existía en la base pero no había
 * ninguna pantalla ni endpoint para verlo.
 */
@Injectable()
export class MovimientosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(filtros: FiltrosMovimientos): Promise<MovimientoDto[]> {
    const limite = Math.min(filtros.limit ?? 100, MAX_LIMITE);
    let query = this.supabase
      .getClient()
      .from('movimientos_inventario')
      .select(MOVIMIENTO_SELECT)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (filtros.insumoId) query = query.eq('insumo_id', filtros.insumoId);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros.desde) query = query.gte('created_at', filtros.desde);
    if (filtros.hasta) query = query.lte('created_at', filtros.hasta);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((m: any) => ({
      id: m.id,
      insumo_id: m.insumo_id,
      insumo_nombre: m.insumos?.nombre ?? '(insumo eliminado)',
      unidad_medida: m.insumos?.unidad_medida ?? 'g',
      tipo: m.tipo,
      cantidad_g: m.cantidad_g,
      referencia_tipo: m.referencia_tipo,
      referencia_id: m.referencia_id,
      motivo: m.motivo,
      created_at: m.created_at,
    }));
  }
}
