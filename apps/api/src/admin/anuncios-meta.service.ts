import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import { fechaHaceDias } from './anuncios-reglas';
import {
  DIAS_HISTORICO_META,
  DIAS_REPASO_META,
  filasDeInsights,
  urlInsights,
  type FilaAnuncioDiario,
  type InsightMeta,
} from './anuncios-meta';

const MAX_PAGINAS = 20;
const LOTE_GUARDADO = 500;

export interface ResultadoSincronizacion {
  estado: 'sincronizado' | 'apagado';
  desde: string;
  hasta: string;
  filas: number;
}

interface PaginaInsights {
  data?: InsightMeta[];
  paging?: { next?: string };
}

/**
 * Trae de la Marketing API el gasto diario por anuncio y lo guarda en
 * `anuncios_meta_diario`. Sin `META_AD_ACCOUNT_ID` y un token con `ads_read`
 * queda apagado y la plataforma sigue igual.
 */
@Injectable()
export class AnunciosMetaService {
  private readonly logger = new Logger(AnunciosMetaService.name);
  private readonly cuenta: string | undefined;
  private readonly token: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.cuenta = this.config.get<string>('META_AD_ACCOUNT_ID');
    this.token =
      this.config.get<string>('META_ADS_ACCESS_TOKEN') ??
      this.config.get<string>('META_EVENTS_ACCESS_TOKEN') ??
      this.config.get<string>('META_CAPI_ACCESS_TOKEN');
  }

  /** 6:00 a.m. en Bogotá (11:00 UTC): repasa los últimos días porque Meta ajusta las cifras. */
  @Cron('0 11 * * *', { name: 'sincronizar-anuncios-meta' })
  async sincronizarCadaDia(): Promise<void> {
    try {
      const r = await this.sincronizar(fechaHaceDias(DIAS_REPASO_META));
      this.logger.log(
        `Anuncios de Meta: ${r.estado}, ${r.filas} filas (${r.desde} a ${r.hasta})`,
      );
    } catch (err) {
      this.logger.error(
        `No se pudo sincronizar los anuncios de Meta: ${(err as Error).message}`,
      );
    }
  }

  async sincronizar(desde?: string): Promise<ResultadoSincronizacion> {
    const inicio = desde ?? fechaHaceDias(DIAS_HISTORICO_META);
    const hasta = fechaHaceDias(0);
    if (!this.cuenta || !this.token) {
      return { estado: 'apagado', desde: inicio, hasta, filas: 0 };
    }
    const filas = await this.traer(this.cuenta, this.token, inicio, hasta);
    await this.guardar(filas);
    return {
      estado: 'sincronizado',
      desde: inicio,
      hasta,
      filas: filas.length,
    };
  }

  private async traer(
    cuenta: string,
    token: string,
    desde: string,
    hasta: string,
  ): Promise<FilaAnuncioDiario[]> {
    const insights: InsightMeta[] = [];
    let url: string | undefined = urlInsights(cuenta, desde, hasta);
    for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina += 1) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Marketing API ${res.status}: ${await res.text()}`);
      }
      const cuerpo = (await res.json()) as PaginaInsights;
      insights.push(...(cuerpo.data ?? []));
      url = cuerpo.paging?.next;
    }
    return filasDeInsights(insights);
  }

  private async guardar(filas: FilaAnuncioDiario[]): Promise<void> {
    const ahora = new Date().toISOString();
    for (let i = 0; i < filas.length; i += LOTE_GUARDADO) {
      const lote = filas
        .slice(i, i + LOTE_GUARDADO)
        .map((f) => ({ ...f, actualizado_en: ahora }));
      const { error } = await this.supabase
        .getClient()
        .from('anuncios_meta_diario')
        .upsert(lote, { onConflict: 'fecha,anuncio_id' });
      if (error) throw errorDeBase(error);
    }
  }
}
