import { Injectable, NotFoundException } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota, finDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import { fechaHaceDias } from './anuncios-reglas';
import {
  resumenCostos,
  SELECT_VARIANTE_COSTO,
  varianteConCosto,
  variantesParaCostos,
  type FilaVarianteCosto,
  type ResumenCostosDto,
  type VarianteCostoDto,
} from './costos-reglas';
import {
  resumenRentabilidad,
  type FilaItemCosto,
  type ResumenRentabilidad,
} from './rentabilidad';

export interface ListaCostosDto {
  variantes: VarianteCostoDto[];
  resumen: ResumenCostosDto;
}

export interface RentabilidadPeriodoDto extends ResumenRentabilidad {
  desde: string;
  hasta: string;
  pedidos: number;
}

const DIAS_POR_DEFECTO = 30;
const LIMITE_PEDIDOS = 5000;

/** Costo de producto por variante (lo carga el dueño) y lo que deja lo vendido. */
@Injectable()
export class CostosAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<ListaCostosDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('variantes_producto')
      .select(SELECT_VARIANTE_COSTO)
      .returns<FilaVarianteCosto[]>();
    if (error) throw errorDeBase(error);
    const variantes = variantesParaCostos(data ?? []);
    return { variantes, resumen: resumenCostos(variantes) };
  }

  /** `costo: null` borra el costo (la variante vuelve a quedar "sin costo"). */
  async fijar(id: string, costo: number | null): Promise<VarianteCostoDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('variantes_producto')
      .update({ costo })
      .eq('id', id)
      .select(SELECT_VARIANTE_COSTO)
      .maybeSingle<FilaVarianteCosto>();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('La variante no existe.');
    return varianteConCosto(data);
  }

  /** Lo vendido en productos, su costo vigente y la utilidad, de los pedidos no cancelados. */
  async rentabilidad(
    desde?: string,
    hasta?: string,
  ): Promise<RentabilidadPeriodoDto> {
    const dia1 = desde ?? fechaHaceDias(DIAS_POR_DEFECTO);
    const dia2 = hasta ?? fechaHaceDias(0);
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('id, items_pedido(cantidad, subtotal, variantes_producto(costo))')
      .neq('estado', 'cancelado')
      .gte('created_at', inicioDiaBogota(dia1))
      .lte('created_at', finDiaBogota(dia2))
      .limit(LIMITE_PEDIDOS)
      .returns<{ id: string; items_pedido: FilaItemCosto[] | null }[]>();
    if (error) throw errorDeBase(error);
    const pedidos = data ?? [];
    return {
      desde: dia1,
      hasta: dia2,
      pedidos: pedidos.length,
      ...resumenRentabilidad(pedidos),
    };
  }
}
