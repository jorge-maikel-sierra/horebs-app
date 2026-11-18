import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import { fechaHaceDias } from './anuncios-reglas';
import {
  DIAS_HISTORICO_META,
  DIAS_REPASO_META,
  filasDeCreativos,
  filasDeInsights,
  urlCreativos,
  urlInsights,
  type AnuncioMeta,
  type InsightMeta,
} from './anuncios-meta';

const MAX_PAGINAS = 20;
const LOTE_GUARDADO = 500;

export interface ResultadoSincronizacion {
  estado: 'sincronizado' | 'apagado';
  desde: string;
  hasta: string;
  filas: number;
  creativos: number;
}

interface PaginaMeta<T> {
  data?: T[];
  paging?: { next?: string };
}

/**
 * Trae de la Marketing API el gasto diario por anuncio (con mensajes
 * iniciados y frecuencia) y el creativo de cada uno. Sin `META_AD_ACCOUNT_ID`
 * y un token con `ads_read` queda apagado y la plataforma sigue igual.
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
        `Anuncios de Meta: ${r.estado}, ${r.filas} filas y ${r.creativos} creativos (${r.desde} a ${r.hasta})`,
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
      return {
        estado: 'apagado',
        desde: inicio,
        hasta,
        filas: 0,
        creativos: 0,
      };
    }
    const insights = await this.paginar<InsightMeta>(
      urlInsights(this.cuenta, inicio, hasta),
      this.token,
    );
    const filas = filasDeInsights(insights);
    await this.guardar('anuncios_meta_diario', 'fecha,anuncio_id', filas);
    const creativos = await this.sincronizarCreativos(this.cuenta, this.token);
    return {
      estado: 'sincronizado',
      desde: inicio,
      hasta,
      filas: filas.length,
      creativos,
    };
  }

  /** El creativo es un adorno del tablero: si falla, el gasto ya guardado no se pierde. */
  private async sincronizarCreativos(
    cuenta: string,
    token: string,
  ): Promise<number> {
    try {
      const anuncios = await this.paginar<AnuncioMeta>(
        urlCreativos(cuenta),
        token,
      );
      const filas = filasDeCreativos(anuncios);
      await this.guardar('anuncios_meta_creativos', 'anuncio_id', filas);
      return filas.length;
    } catch (err) {
      this.logger.warn(
        `No se pudieron traer los creativos: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  private async paginar<T>(primera: string, token: string): Promise<T[]> {
    const todos: T[] = [];
    let url: string | undefined = primera;
    for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina += 1) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Marketing API ${res.status}: ${await res.text()}`);
      }
      const cuerpo = (await res.json()) as PaginaMeta<T>;
      todos.push(...(cuerpo.data ?? []));
      url = cuerpo.paging?.next;
    }
    return todos;
  }

  private async guardar(
    tabla: string,
    conflicto: string,
    filas: object[],
  ): Promise<void> {
    const ahora = new Date().toISOString();
    for (let i = 0; i < filas.length; i += LOTE_GUARDADO) {
      const lote = filas
        .slice(i, i + LOTE_GUARDADO)
        .map((f) => ({ ...f, actualizado_en: ahora }));
      const { error } = await this.supabase
        .getClient()
        .from(tabla)
        .upsert(lote, { onConflict: conflicto });
      if (error) throw errorDeBase(error);
    }
  }
}
