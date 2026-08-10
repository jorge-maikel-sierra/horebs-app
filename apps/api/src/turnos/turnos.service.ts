import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TurnoDto {
  id: string;
  abierto_por: string;
  monto_inicial: number;
  abierto_en: string;
  cerrado_por: string | null;
  cerrado_en: string | null;
  monto_final_contado: number | null;
  notas_cierre: string | null;
  estado: 'abierto' | 'cerrado';
}

export interface ResumenVentasDto {
  total_efectivo: number;
  total_transferencia: number;
  total_tarjeta: number;
  total_ventas: number;
  cantidad_ventas: number;
}

export interface TurnoActualDto {
  turno: TurnoDto | null;
  resumen: ResumenVentasDto | null;
}

export interface TurnoCerradoDto extends TurnoDto {
  resumen: ResumenVentasDto;
  monto_esperado_efectivo: number;
  diferencia_caja: number | null;
}

const TURNO_SELECT =
  'id, abierto_por, monto_inicial, abierto_en, cerrado_por, cerrado_en, monto_final_contado, notas_cierre, estado';

/**
 * El turno delimita un rango de tiempo sobre un único mostrador físico
 * (nunca hay dos turnos "abierto" a la vez, ver índice único en la
 * migración). Por eso el resumen de ventas se calcula por rango de
 * fecha sobre pedidos con canal='pos', sin necesidad de enlazar cada
 * pedido a su turno.
 */
@Injectable()
export class TurnosService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerActual(): Promise<TurnoActualDto> {
    const client = this.supabase.getClient();
    const turno = await this.buscarTurnoAbierto(client);
    if (!turno) return { turno: null, resumen: null };

    const resumen = await this.calcularResumen(client, turno.abierto_en, null);
    return { turno, resumen };
  }

  async abrir(montoInicial: number, usuarioId: string): Promise<TurnoDto> {
    if (
      typeof montoInicial !== 'number' ||
      !Number.isFinite(montoInicial) ||
      montoInicial < 0
    ) {
      throw new BadRequestException('El monto inicial en caja no es válido.');
    }

    const client = this.supabase.getClient();
    const yaAbierto = await this.buscarTurnoAbierto(client);
    if (yaAbierto) {
      throw new ConflictException(
        'Ya hay un turno abierto. Cerralo antes de abrir uno nuevo.',
      );
    }

    const { data, error } = await client
      .from('turnos')
      .insert({ abierto_por: usuarioId, monto_inicial: montoInicial })
      .select(TURNO_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async cerrar(
    usuarioId: string,
    montoFinalContado: number | undefined,
    notasCierre: string | undefined,
  ): Promise<TurnoCerradoDto> {
    if (
      montoFinalContado !== undefined &&
      (typeof montoFinalContado !== 'number' ||
        !Number.isFinite(montoFinalContado) ||
        montoFinalContado < 0)
    ) {
      throw new BadRequestException('El monto contado no es válido.');
    }

    const client = this.supabase.getClient();
    const turno = await this.buscarTurnoAbierto(client);
    if (!turno) throw new NotFoundException('No hay un turno abierto para cerrar.');

    const cerradoEn = new Date().toISOString();
    const resumen = await this.calcularResumen(client, turno.abierto_en, cerradoEn);

    const { data: actualizado, error } = await client
      .from('turnos')
      .update({
        estado: 'cerrado',
        cerrado_por: usuarioId,
        cerrado_en: cerradoEn,
        monto_final_contado: montoFinalContado ?? null,
        notas_cierre: notasCierre?.trim() || null,
        total_efectivo: resumen.total_efectivo,
        total_transferencia: resumen.total_transferencia,
        total_tarjeta: resumen.total_tarjeta,
        total_ventas: resumen.total_ventas,
        cantidad_ventas: resumen.cantidad_ventas,
      })
      .eq('id', turno.id)
      .select(TURNO_SELECT)
      .single();
    if (error) throw error;

    const montoEsperadoEfectivo = turno.monto_inicial + resumen.total_efectivo;
    return {
      ...actualizado,
      resumen,
      monto_esperado_efectivo: montoEsperadoEfectivo,
      diferencia_caja:
        montoFinalContado !== undefined
          ? montoFinalContado - montoEsperadoEfectivo
          : null,
    };
  }

  private async buscarTurnoAbierto(
    client: SupabaseClient,
  ): Promise<TurnoDto | null> {
    const { data, error } = await client
      .from('turnos')
      .select(TURNO_SELECT)
      .eq('estado', 'abierto')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  private async calcularResumen(
    client: SupabaseClient,
    desde: string,
    hasta: string | null,
  ): Promise<ResumenVentasDto> {
    let query = client
      .from('pedidos')
      .select('metodo_pago, total')
      .eq('canal', 'pos')
      .gte('created_at', desde);
    if (hasta) query = query.lte('created_at', hasta);

    const { data, error } = await query;
    if (error) throw error;

    const resumen: ResumenVentasDto = {
      total_efectivo: 0,
      total_transferencia: 0,
      total_tarjeta: 0,
      total_ventas: 0,
      cantidad_ventas: data?.length ?? 0,
    };
    for (const pedido of data ?? []) {
      resumen.total_ventas += pedido.total;
      if (pedido.metodo_pago === 'efectivo') resumen.total_efectivo += pedido.total;
      else if (pedido.metodo_pago === 'transferencia')
        resumen.total_transferencia += pedido.total;
      else if (pedido.metodo_pago === 'tarjeta')
        resumen.total_tarjeta += pedido.total;
    }
    return resumen;
  }
}
