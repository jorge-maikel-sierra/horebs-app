import { Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { inicioDiaBogota } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import {
  campanasRecientes,
  rendimientoPorAnuncio,
  rendimientoPorCampana,
  resumenGeneral,
  type AnuncioRendimientoDto,
  type CampanaRendimientoDto,
  type CampanaReciente,
  type FilaCreativo,
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
  anuncios: AnuncioRendimientoDto[];
  /** Último día con gasto sincronizado; null si Meta aún no se ha conectado. */
  gasto_hasta: string | null;
}

const COLUMNAS_PEDIDO =
  'id, total, estado, cliente_id, origen_fuente, origen_anuncio_id, origen_ref, origen_campana_id, atribucion_web, items_pedido(cantidad, subtotal, variantes_producto(costo))';
const COLUMNAS_GASTO =
  'fecha, anuncio_id, campana_id, campana_nombre, gasto, impresiones, alcance, clics, frecuencia, conversaciones, clics_enlace';
const COLUMNAS_CREATIVO =
  'anuncio_id, nombre, estado, miniatura_url, titulo, texto';

type FilaPedidoCompleta = FilaPedidoOrigen & FilaPedidoTablero;

interface DatosTablero {
  conversaciones: FilaConversacionOrigen[];
  pedidos: FilaPedidoCompleta[];
  gasto: FilaGastoDia[];
  nuevos: Set<string>;
  creativos: FilaCreativo[];
}

/** Ventas, conversaciones y gasto por anuncio, campaña o enlace con `ref`. */
@Injectable()
export class AnunciosAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async tablero(desde?: string): Promise<TableroAnunciosDto> {
    const dia = desde ?? fechaHaceDias(DIAS_TABLERO_DEFECTO);
    const d = await this.cargar(dia, inicioDiaBogota(dia));
    return {
      desde: dia,
      origenes: rendimientoPorOrigen(
        d.conversaciones,
        d.pedidos.filter((p) => p.origen_fuente !== null),
      ),
      general: resumenGeneral(d.gasto, d.pedidos),
      campanas: rendimientoPorCampana(d.gasto, d.pedidos, d.nuevos),
      anuncios: rendimientoPorAnuncio(d.gasto, d.creativos, d.pedidos),
      gasto_hasta: d.gasto.reduce<string | null>(
        (max, g) => (max === null || g.fecha > max ? g.fecha : max),
        null,
      ),
    };
  }

  private async cargar(dia: string, inicio: string): Promise<DatosTablero> {
    const client = this.supabase.getClient();
    const [conversaciones, pedidos, gasto, nuevos, creativos] =
      await Promise.all([
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
        client
          .from('anuncios_meta_creativos')
          .select(COLUMNAS_CREATIVO)
          .returns<FilaCreativo[]>(),
      ]);
    for (const r of [conversaciones, pedidos, gasto, nuevos, creativos]) {
      if (r.error) throw errorDeBase(r.error);
    }
    return {
      conversaciones: conversaciones.data ?? [],
      pedidos: pedidos.data ?? [],
      gasto: gasto.data ?? [],
      nuevos: new Set((nuevos.data ?? []).map((c) => c.id)),
      creativos: creativos.data ?? [],
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
