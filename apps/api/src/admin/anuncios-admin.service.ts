import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import {
  campanasRecientes,
  rendimientoPorCampana,
  resumenGeneral,
  type CampanaRendimientoDto,
  type CampanaReciente,
  type FilaGastoDia,
  type FilaPedidoTablero,
  type ResumenGeneralDto,
} from './anuncios-gasto';
import {
  DIAS_TABLERO_DEFECTO,
  fechaHaceDias,
  rendimientoPorOrigen,
  type FilaConversacionOrigen,
  type FilaPedidoOrigen,
  type RendimientoOrigenDto,
} from './anuncios-reglas';

export interface TableroAnunciosDto {
  desde: string;
  origenes: RendimientoOrigenDto[];
  general: ResumenGeneralDto;
  campanas: CampanaRendimientoDto[];
  /** Último día con gasto sincronizado; null si Meta aún no se ha conectado. */
  gasto_hasta: string | null;
}

const COLUMNAS_PEDIDO =
  'id, total, estado, cliente_id, origen_fuente, origen_anuncio_id, origen_ref, origen_campana_id, atribucion_web';
const COLUMNAS_GASTO =
  'fecha, anuncio_id, campana_id, campana_nombre, gasto, impresiones, alcance, clics';

type FilaPedidoCompleta = FilaPedidoOrigen & FilaPedidoTablero;

/** Ventas, conversaciones y gasto por anuncio, campaña o enlace con `ref`. */
@Injectable()
export class AnunciosAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async tablero(desde?: string): Promise<TableroAnunciosDto> {
    const dia = desde ?? fechaHaceDias(DIAS_TABLERO_DEFECTO);
    const inicio = inicioDiaBogota(dia);
    const client = this.supabase.getClient();

    const [conversaciones, pedidos, gasto, nuevos] = await Promise.all([
      client
        .from('conversaciones_bot')
        .select('origen_fuente, origen_anuncio_id, origen_ref, origen_titulo')
        .gte('origen_capturado_en', inicio)
        .returns<FilaConversacionOrigen[]>(),
      client
        .from('pedidos')
        .select(COLUMNAS_PEDIDO)
        .gte('created_at', inicio)
        .returns<FilaPedidoCompleta[]>(),
      client
        .from('anuncios_meta_diario')
        .select(COLUMNAS_GASTO)
        .gte('fecha', dia)
        .returns<FilaGastoDia[]>(),
      client
        .from('clientes')
        .select('id')
        .gte('created_at', inicio)
        .returns<{ id: string }[]>(),
    ]);
    for (const r of [conversaciones, pedidos, gasto, nuevos]) {
      if (r.error) throw errorDeBase(r.error);
    }
    const filasPedido = pedidos.data ?? [];
    const filasGasto = gasto.data ?? [];

    return {
      desde: dia,
      origenes: rendimientoPorOrigen(
        conversaciones.data ?? [],
        filasPedido.filter((p) => p.origen_fuente !== null),
      ),
      general: resumenGeneral(filasGasto, filasPedido),
      campanas: rendimientoPorCampana(
        filasGasto,
        filasPedido,
        new Set((nuevos.data ?? []).map((c) => c.id)),
      ),
      gasto_hasta: filasGasto.reduce<string | null>(
        (max, g) => (max === null || g.fecha > max ? g.fecha : max),
        null,
      ),
    };
  }

  /** Campañas con gasto en los últimos 30 días, para el selector "¿Por qué anuncio llegó?" de la caja. */
  async campanasRecientes(): Promise<CampanaReciente[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('anuncios_meta_diario')
      .select(COLUMNAS_GASTO)
      .gte('fecha', fechaHaceDias(DIAS_TABLERO_DEFECTO))
      .returns<FilaGastoDia[]>();
    if (error) throw errorDeBase(error);
    return campanasRecientes(data ?? []);
  }
}
