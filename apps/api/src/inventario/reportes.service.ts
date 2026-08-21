import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

// Riohacha es UTC-5 fijo (sin horario de verano) — mismo offset manual
// que ya usa informes.service.ts en el backend, en vez de Intl.DateTimeFormat
// (eso queda para el frontend).
const OFFSET_MS = 5 * 60 * 60 * 1000;

function fechaHoyBogota(): string {
  return new Date(Date.now() - OFFSET_MS).toISOString().slice(0, 10);
}

@Injectable()
export class ReportesService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerReporte(): Promise<ReporteInventarioDto> {
    const client = this.supabase.getClient();

    const { data: insumos, error: errInsumos } = await client
      .from('insumos')
      .select('id, nombre, unidad_medida, stock_actual_g, stock_minimo_g, costo_unitario_g')
      .eq('activo', true);
    if (errInsumos) throw errInsumos;

    const filas = insumos ?? [];
    const valorizacionTotal = filas.reduce(
      (acc, i) => acc + i.stock_actual_g * i.costo_unitario_g,
      0,
    );
    const aDto = (i: (typeof filas)[number]): InsumoAlertaDto => ({
      id: i.id,
      nombre: i.nombre,
      unidad_medida: i.unidad_medida,
      stock_actual_g: i.stock_actual_g,
      stock_minimo_g: i.stock_minimo_g,
    });
    const insumosStockNegativo = filas.filter((i) => i.stock_actual_g < 0).map(aDto);
    const insumosStockBajo = filas
      .filter((i) => i.stock_actual_g >= 0 && i.stock_actual_g <= i.stock_minimo_g)
      .map(aDto);

    const [año, mes] = fechaHoyBogota().split('-').map(Number);
    const inicioMesActual = `${año}-${String(mes).padStart(2, '0')}-01`;
    const mesAnteriorDate = mes === 1 ? { año: año - 1, mes: 12 } : { año, mes: mes - 1 };
    const inicioMesAnterior = `${mesAnteriorDate.año}-${String(mesAnteriorDate.mes).padStart(2, '0')}-01`;

    const { data: comprasMesActual, error: errComprasActual } = await client
      .from('compras')
      .select('subtotal, otros_cargos')
      .gte('fecha', inicioMesActual);
    if (errComprasActual) throw errComprasActual;

    const { data: comprasMesAnterior, error: errComprasAnterior } = await client
      .from('compras')
      .select('subtotal, otros_cargos')
      .gte('fecha', inicioMesAnterior)
      .lt('fecha', inicioMesActual);
    if (errComprasAnterior) throw errComprasAnterior;

    const sumarGasto = (compras: { subtotal: number; otros_cargos: number }[]) =>
      compras.reduce((acc, c) => acc + c.subtotal + c.otros_cargos, 0);

    const { count: recetasSinCostear, error: errRecetas } = await client
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .eq('activa', true)
      .eq('costo_calculado', 0);
    if (errRecetas) throw errRecetas;

    return {
      valorizacionTotal,
      insumosStockNegativo,
      insumosStockBajo,
      gastoComprasMesActual: sumarGasto(comprasMesActual ?? []),
      gastoComprasMesAnterior: sumarGasto(comprasMesAnterior ?? []),
      recetasSinCostear: recetasSinCostear ?? 0,
    };
  }
}
