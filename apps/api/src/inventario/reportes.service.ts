import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { fechaBogota } from '../common/horario';
import {
  gastoDeCompras,
  insumosEnStockBajo,
  insumosEnStockNegativo,
  rangoDeMeses,
  valorizacionTotal,
} from './reportes-reglas';
import {
  INSUMO_REPORTE_SELECT,
  type FilaGastoCompra,
  type FilaInsumoReporte,
  type ReporteInventarioDto,
} from './reportes.tipos';

export type * from './reportes.tipos';

@Injectable()
export class ReportesService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerReporte(): Promise<ReporteInventarioDto> {
    const client = this.supabase.getClient();
    const { inicioMesActual, inicioMesAnterior } = rangoDeMeses(
      fechaBogota(new Date()),
    );

    const insumos = await this.leerInsumos(client);
    const gastoActual = await this.leerGasto(client, inicioMesActual);
    const gastoAnterior = await this.leerGasto(
      client,
      inicioMesAnterior,
      inicioMesActual,
    );

    return {
      valorizacionTotal: valorizacionTotal(insumos),
      insumosStockNegativo: insumosEnStockNegativo(insumos),
      insumosStockBajo: insumosEnStockBajo(insumos),
      gastoComprasMesActual: gastoActual,
      gastoComprasMesAnterior: gastoAnterior,
      recetasSinCostear: await this.contarRecetasSinCostear(client),
    };
  }

  private async leerInsumos(
    client: SupabaseClient,
  ): Promise<FilaInsumoReporte[]> {
    const { data, error } = await client
      .from('insumos')
      .select(INSUMO_REPORTE_SELECT)
      .eq('activo', true)
      .returns<FilaInsumoReporte[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /** Gasto de las compras desde `desde` (incluida) hasta `hasta` (excluida, si se da). */
  private async leerGasto(
    client: SupabaseClient,
    desde: string,
    hasta?: string,
  ): Promise<number> {
    let query = client
      .from('compras')
      .select('subtotal, otros_cargos')
      .gte('fecha', desde);
    if (hasta) query = query.lt('fecha', hasta);

    const { data, error } = await query.returns<FilaGastoCompra[]>();
    if (error) throw errorDeBase(error);
    return gastoDeCompras(data ?? []);
  }

  private async contarRecetasSinCostear(
    client: SupabaseClient,
  ): Promise<number> {
    const { count, error } = await client
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('activa', true)
      .eq('costo_calculado', 0);
    if (error) throw errorDeBase(error);
    return count ?? 0;
  }
}
