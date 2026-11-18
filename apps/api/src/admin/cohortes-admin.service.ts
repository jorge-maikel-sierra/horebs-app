import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import {
  campanaDePedido,
  indices,
  type FilaGastoDia,
  type FilaPedidoTablero,
} from './anuncios-gasto';
import { fechaHaceDias } from './anuncios-reglas';
import {
  cohortesPorCampana,
  cohortesPorMes,
  type CohorteCampanaDto,
  type CohorteMesDto,
  type GastoCampana,
  type PedidoCohorte,
} from './cohortes';

export interface CohortesDto {
  desde: string;
  por_mes: CohorteMesDto[];
  por_campana: CohorteCampanaDto[];
  /** Clientes creados en el período que ya hicieron un pedido. */
  clientes_nuevos: number;
  /** De esos, los que se pudieron ligar a una campaña por su primer pedido. */
  clientes_atribuidos: number;
  /** Los pedidos de WooCommerce no se migraron: la "primera compra" es la primera en esta plataforma. */
  primera_compra_desde: string | null;
}

const DIAS_COHORTES_DEFECTO = 90;
const LOTE = 1000;
const LARGO_FECHA = 10;
const COLUMNAS_PEDIDO =
  'id, cliente_id, total, estado, created_at, origen_anuncio_id, origen_campana_id, atribucion_web';

type FilaPedidoCohorte = Omit<FilaPedidoTablero, 'items_pedido'> & {
  created_at: string;
};

/** Recompra por mes de la primera compra y por la campaña que trajo al cliente. */
@Injectable()
export class CohortesAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async consultar(desde?: string): Promise<CohortesDto> {
    const dia = desde ?? fechaHaceDias(DIAS_COHORTES_DEFECTO);
    const inicio = inicioDiaBogota(dia);
    const [pedidos, gasto, nuevos] = await Promise.all([
      this.pedidos(),
      this.gasto(dia),
      this.clientesNuevos(inicio),
    ]);
    const idx = indices(gasto);
    const cohorte: PedidoCohorte[] = pedidos.map((p) => ({
      cliente_id: p.cliente_id,
      total: p.total,
      estado: p.estado,
      created_at: p.created_at,
      campana_id: campanaDePedido({ ...p, items_pedido: null }, idx),
    }));
    const ahora = new Date();
    const campanas = cohortesPorCampana(cohorte, {
      gasto: gastoPorCampana(gasto),
      desde: inicio,
      nuevosIds: nuevos,
      ahora,
    });
    return {
      desde: dia,
      por_mes: cohortesPorMes(cohorte, ahora),
      por_campana: campanas.campanas,
      clientes_nuevos: campanas.nuevos,
      clientes_atribuidos: campanas.atribuidos,
      primera_compra_desde:
        pedidos
          .map((p) => p.created_at)
          .sort()[0]
          ?.slice(0, LARGO_FECHA) ?? null,
    };
  }

  /** Todos los pedidos (con su cliente): la primera compra de alguien puede ser anterior al período. */
  private async pedidos(): Promise<FilaPedidoCohorte[]> {
    const todos: FilaPedidoCohorte[] = [];
    for (let desde = 0; ; desde += LOTE) {
      const { data, error } = await this.supabase
        .getClient()
        .from('pedidos')
        .select(COLUMNAS_PEDIDO)
        .order('created_at')
        .range(desde, desde + LOTE - 1)
        .returns<FilaPedidoCohorte[]>();
      if (error) throw errorDeBase(error);
      const lote = data ?? [];
      todos.push(...lote);
      if (lote.length < LOTE) return todos;
    }
  }

  private async gasto(dia: string): Promise<FilaGastoDia[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('anuncios_meta_diario')
      .select(
        'fecha, anuncio_id, campana_id, campana_nombre, gasto, impresiones, alcance, clics, frecuencia, conversaciones, clics_enlace',
      )
      .gte('fecha', dia)
      .returns<FilaGastoDia[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  private async clientesNuevos(inicio: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('id')
      .gte('created_at', inicio)
      .returns<{ id: string }[]>();
    if (error) throw errorDeBase(error);
    return new Set((data ?? []).map((c) => c.id));
  }
}

function gastoPorCampana(gasto: FilaGastoDia[]): Map<string, GastoCampana> {
  const mapa = new Map<string, GastoCampana>();
  for (const g of gasto) {
    const actual = mapa.get(g.campana_id) ?? {
      nombre: g.campana_nombre ?? g.campana_id,
      gasto: 0,
    };
    actual.gasto += Number(g.gasto);
    mapa.set(g.campana_id, actual);
  }
  return mapa;
}
