import { BadRequestException, Injectable } from '@nestjs/common';
import { errorDeBase } from '../common/error-de-base';
import { fechaBogota, finDiaBogota, inicioDiaBogota } from '../common/horario';
import { LARGO_MES } from '../common/tiempo';
import { SupabaseService } from '../supabase/supabase.service';
import type { FilaPedidoAds } from './google-ads-atribucion';
import { diasEntre, rangoAnterior, sumarDias } from './google-ads-metricas';
import {
  armarTablero,
  type DatosTableroAds,
  type Rango,
  type TableroGoogleAdsDto,
} from './google-ads-tablero';
import type {
  FilaAnuncio,
  FilaCambio,
  FilaCampanaDia,
  FilaConversionDia,
  FilaEstadoCampana,
  FilaPalabraDia,
  FilaSegmentoDia,
  FilaTerminoDia,
} from './google-ads.tipos';

export interface CampanaCaja {
  id: string;
  nombre: string;
}

/** Período por defecto: 28 días (múltiplo de 7, no sesga por día de semana). */
export const DIAS_TABLERO_DEFECTO = 28;
export const MAX_DIAS_TABLERO = 180;
// PostgREST devuelve como mucho 1.000 filas por consulta.
const PAGINA = 1000;

interface Respuesta<T> {
  data: T[] | null;
  error: unknown;
}

type Pagina<T> = (desde: number, hasta: number) => PromiseLike<Respuesta<T>>;

/**
 * Lee las tablas de Google Ads, los pedidos y el gasto de Meta del período y
 * del anterior, y arma el tablero con `armarTablero` (puro).
 */
@Injectable()
export class GoogleAdsTableroService {
  constructor(private readonly supabase: SupabaseService) {}

  async tablero(desde?: string, hasta?: string): Promise<TableroGoogleAdsDto> {
    const actual = this.resolverRango(desde, hasta);
    const anterior = rangoAnterior(actual.desde, actual.hasta);
    const datos = await this.cargar(actual, anterior);
    return armarTablero({ ...datos, actual, anterior, ahora: new Date() });
  }

  /** `hasta` es ayer por defecto: el día de hoy está incompleto. */
  resolverRango(desde?: string, hasta?: string): Rango {
    const fin = hasta ?? sumarDias(fechaBogota(new Date()), -1);
    const inicio = desde ?? sumarDias(fin, 1 - DIAS_TABLERO_DEFECTO);
    if (inicio > fin) {
      throw new BadRequestException(
        'El parámetro "desde" no puede ser posterior a "hasta".',
      );
    }
    if (diasEntre(inicio, fin) > MAX_DIAS_TABLERO) {
      throw new BadRequestException(
        `El rango no puede pasar de ${MAX_DIAS_TABLERO} días.`,
      );
    }
    return { desde: inicio, hasta: fin };
  }

  private async cargar(
    actual: Rango,
    anterior: Rango,
  ): Promise<Omit<DatosTableroAds, 'actual' | 'anterior' | 'ahora'>> {
    const total: Rango = { desde: anterior.desde, hasta: actual.hasta };
    const [ads, negocio, anuncios, estados, ultimoEnvio] = await Promise.all([
      this.cargarAds(actual, anterior, total),
      this.cargarNegocio(total),
      this.foto<FilaAnuncio>('google_ads_anuncios', COLUMNAS_ANUNCIO),
      this.foto<FilaEstadoCampana>(
        'google_ads_campanas_estado',
        COLUMNAS_ESTADO,
      ),
      this.ultimoEnvio(),
    ]);
    return { ...ads, ...negocio, anuncios, estados, ultimoEnvio };
  }

  private async cargarAds(
    actual: Rango,
    anterior: Rango,
    total: Rango,
  ): Promise<
    Pick<
      DatosTableroAds,
      | 'campanas'
      | 'palabras'
      | 'terminos'
      | 'segmentos'
      | 'conversiones'
      | 'cambios'
    >
  > {
    // El ritmo del mes necesita el mes completo aunque el período sea corto.
    const inicioMes = `${actual.hasta.slice(0, LARGO_MES)}-01`;
    const desdeCampanas = [anterior.desde, inicioMes].sort()[0];
    const [campanas, palabras, terminos, segmentos, conversiones, cambios] =
      await Promise.all([
        this.porFecha<FilaCampanaDia>(
          'google_ads_campana_diario',
          { desde: desdeCampanas, hasta: actual.hasta },
          ['campana_id'],
        ),
        this.porFecha<FilaPalabraDia>('google_ads_palabras_diario', actual, [
          'grupo_id',
          'criterio_id',
        ]),
        this.porFecha<FilaTerminoDia>('google_ads_terminos_diario', actual, [
          'grupo_id',
          'termino',
        ]),
        this.porFecha<FilaSegmentoDia>('google_ads_segmentos_diario', actual, [
          'campana_id',
          'dimension',
          'clave',
        ]),
        this.porFecha<FilaConversionDia>(
          'google_ads_conversiones_diario',
          total,
          ['campana_id', 'accion'],
        ),
        this.porFecha<FilaCambio>('google_ads_cambios', actual, [
          'recurso_cambio',
        ]),
      ]);
    return { campanas, palabras, terminos, segmentos, conversiones, cambios };
  }

  private async cargarNegocio(
    total: Rango,
  ): Promise<
    Pick<DatosTableroAds, 'pedidos' | 'gastoMeta' | 'clientesNuevos'>
  > {
    const [pedidos, gastoMeta, clientesNuevos] = await Promise.all([
      this.porCreacion<FilaPedidoAds>('pedidos', COLUMNAS_PEDIDO, total),
      this.porFecha<{ fecha: string; gasto: number }>(
        'anuncios_meta_diario',
        total,
        ['anuncio_id'],
        'fecha, gasto',
      ),
      this.porCreacion<{ created_at: string }>('clientes', 'created_at', total),
    ]);
    return { pedidos, gastoMeta, clientesNuevos };
  }

  private async paginar<T>(consulta: Pagina<T>): Promise<T[]> {
    const todas: T[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await consulta(desde, desde + PAGINA - 1);
      if (error) throw errorDeBase(error);
      todas.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) return todas;
    }
  }

  private porFecha<T>(
    tabla: string,
    r: Rango,
    desempate: string[],
    columnas = '*',
  ): Promise<T[]> {
    return this.paginar<T>((a, b) => {
      let consulta = this.supabase
        .getClient()
        .from(tabla)
        .select(columnas)
        .gte('fecha', r.desde)
        .lte('fecha', r.hasta)
        .order('fecha');
      // Orden total (toda la llave primaria): sin eso, paginar repite o salta filas.
      for (const columna of desempate) consulta = consulta.order(columna);
      return consulta.range(a, b).returns<T[]>();
    });
  }

  private porCreacion<T>(
    tabla: string,
    columnas: string,
    r: Rango,
  ): Promise<T[]> {
    return this.paginar<T>((a, b) =>
      this.supabase
        .getClient()
        .from(tabla)
        .select(columnas)
        .gte('created_at', inicioDiaBogota(r.desde))
        .lte('created_at', finDiaBogota(r.hasta))
        .order('created_at')
        .order('id')
        .range(a, b)
        .returns<T[]>(),
    );
  }

  /** Campañas de Google activas, para el selector "¿Por qué campaña llegó?" de la caja. */
  async campanasActivas(): Promise<CampanaCaja[]> {
    const estados = await this.foto<FilaEstadoCampana>(
      'google_ads_campanas_estado',
      COLUMNAS_ESTADO,
    );
    return estados
      .filter((e) => e.estado === 'ENABLED')
      .map((e) => ({ id: e.campana_id, nombre: e.campana_nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Tablas sin fecha (foto actual): pocas filas, una sola consulta. */
  private async foto<T>(tabla: string, columnas: string): Promise<T[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from(tabla)
      .select(columnas)
      .returns<T[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  private async ultimoEnvio(): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('google_ads_lotes')
      .select('recibido_en')
      .order('recibido_en', { ascending: false })
      .limit(1)
      .maybeSingle<{ recibido_en: string }>();
    if (error) throw errorDeBase(error);
    return data?.recibido_en ?? null;
  }
}

const COLUMNAS_PEDIDO =
  'id, total, estado, created_at, origen_fuente, origen_campana_id, atribucion_web';
const COLUMNAS_ANUNCIO =
  'grupo_id, anuncio_id, campana_id, tipo, estado, fuerza, aprobacion, urls_finales';
const COLUMNAS_ESTADO =
  'campana_id, campana_nombre, estado, estado_principal, motivos_estado, estrategia_puja, estado_puja, presupuesto_diario';
