import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorDeBase } from '../common/error-de-base';
import { MS_POR_SEGUNDO } from '../common/tiempo';
import { validarObjeto } from '../common/validacion';
import { SupabaseService } from '../supabase/supabase.service';
import { firmaGoogleAdsValida } from './google-ads-firma';
import {
  ESQUEMA_LOTE_GOOGLE_ADS,
  motivoRechazoLote,
  normalizarFilas,
  type MotivoRechazo,
} from './google-ads-normalizar';
import type {
  FilaGoogleAds,
  LoteGoogleAds,
  ReporteGoogleAds,
  ResultadoLote,
} from './google-ads.tipos';

const LOTE_GUARDADO = 500;

interface DestinoReporte {
  tabla: string;
  conflicto: string;
  /** Columna con la hora de guardado. */
  sello: 'actualizado_en' | 'capturado_en';
  conFecha: boolean;
}

const DESTINOS = new Map<ReporteGoogleAds, DestinoReporte>([
  ['campanas', destino('google_ads_campana_diario', 'fecha,campana_id')],
  [
    'palabras',
    destino('google_ads_palabras_diario', 'fecha,grupo_id,criterio_id'),
  ],
  ['terminos', destino('google_ads_terminos_diario', 'fecha,grupo_id,termino')],
  [
    'segmentos',
    destino('google_ads_segmentos_diario', 'fecha,campana_id,dimension,clave'),
  ],
  [
    'conversiones',
    destino('google_ads_conversiones_diario', 'fecha,campana_id,accion'),
  ],
  [
    'anuncios',
    {
      tabla: 'google_ads_anuncios',
      conflicto: 'grupo_id,anuncio_id',
      sello: 'capturado_en',
      conFecha: false,
    },
  ],
  ['cambios', destino('google_ads_cambios', 'recurso_cambio')],
  [
    'estado_campanas',
    {
      tabla: 'google_ads_campanas_estado',
      conflicto: 'campana_id',
      sello: 'capturado_en',
      conFecha: false,
    },
  ],
]);

function destino(tabla: string, conflicto: string): DestinoReporte {
  return { tabla, conflicto, sello: 'actualizado_en', conFecha: true };
}

const MENSAJES_RECHAZO = new Map<MotivoRechazo, string>([
  ['cuenta', 'La cuenta de Google Ads no es la del negocio.'],
  ['zona_horaria', 'La cuenta debe estar en la zona horaria America/Bogota.'],
  ['moneda', 'La cuenta debe estar en pesos colombianos (COP).'],
  ['rango', 'El lote necesita un rango de fechas válido.'],
  ['partes', 'La parte no puede ser mayor que el total de partes.'],
  ['filas', 'El lote trae demasiadas filas; hay que partirlo.'],
]);

/**
 * Recibe los lotes que manda el Google Ads Script. Todas las filas de un lote
 * llevan el sello de su parte 1; al llegar la última parte se borran las
 * filas de la ventana (`desde..hasta`) con sello anterior. Así un término que
 * dejó de aparecer en el re-envío no queda guardado de antes, y si una parte
 * falla a mitad lo viejo sigue ahí en vez de quedar un hueco. `lote_id` +
 * `parte` ya recibidos no se vuelven a procesar.
 */
@Injectable()
export class GoogleAdsIngestaService {
  private readonly logger = new Logger(GoogleAdsIngestaService.name);
  private readonly secreto: string | undefined;
  private readonly cuenta: string | undefined;

  constructor(
    config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.secreto = config.get<string>('GOOGLE_ADS_WEBHOOK_SECRETO');
    this.cuenta = config.get<string>('GOOGLE_ADS_CUENTA_ID');
    if (!this.secreto || !this.cuenta) {
      this.logger.warn(
        'Google Ads apagado: faltan GOOGLE_ADS_WEBHOOK_SECRETO o GOOGLE_ADS_CUENTA_ID.',
      );
    }
  }

  firmaValida(rawBody: Buffer, cabecera: string | undefined): boolean {
    return firmaGoogleAdsValida(
      rawBody,
      cabecera,
      this.secreto,
      Math.floor(Date.now() / MS_POR_SEGUNDO),
    );
  }

  async recibir(cuerpo: unknown): Promise<ResultadoLote> {
    const lote = this.validarCabecera(cuerpo);
    const destino = DESTINOS.get(lote.reporte);
    if (!destino) throw new BadRequestException('Reporte desconocido.');
    const base = {
      lote_id: lote.lote_id,
      reporte: lote.reporte,
      parte: lote.parte,
    };
    if (await this.yaRecibido(lote)) {
      return { ...base, filas: 0, estado: 'repetido' };
    }
    const filas = this.validarFilas(lote, destino);
    const sello = await this.selloDelLote(lote);
    await this.guardar(destino, filas, sello);
    if (lote.parte === lote.total_partes) {
      await this.limpiarVentana(lote, destino, sello);
    }
    await this.registrar(lote, filas.length, sello);
    return { ...base, filas: filas.length, estado: 'guardado' };
  }

  private validarCabecera(cuerpo: unknown): LoteGoogleAds {
    const errores = validarObjeto(ESQUEMA_LOTE_GOOGLE_ADS, cuerpo);
    if (errores.length > 0) {
      throw new BadRequestException({
        message: errores.map((e) => e.mensaje).join(' '),
        errores,
      });
    }
    if (!this.cuenta) {
      throw new ServiceUnavailableException('Google Ads no está configurado.');
    }
    const lote = cuerpo as LoteGoogleAds;
    const motivo = motivoRechazoLote(lote, this.cuenta);
    if (motivo) {
      throw new BadRequestException(MENSAJES_RECHAZO.get(motivo));
    }
    return lote;
  }

  /** Arreglo anidado: cada fila se valida aquí contra el esquema de su reporte. */
  private validarFilas(
    lote: LoteGoogleAds,
    destino: DestinoReporte,
  ): FilaGoogleAds[] {
    const { filas, errores } = normalizarFilas(lote.reporte, lote.filas);
    if (errores.length > 0) {
      throw new BadRequestException({
        message: errores.map((e) => e.mensaje).join(' '),
        errores,
      });
    }
    const fuera =
      destino.conFecha &&
      filas.some((f) => {
        const dia = (f as { fecha: string }).fecha;
        return dia < (lote.desde ?? '') || dia > (lote.hasta ?? '');
      });
    if (fuera) {
      throw new BadRequestException(
        'Hay filas con fecha fuera del rango del lote.',
      );
    }
    return filas;
  }

  private async yaRecibido(lote: LoteGoogleAds): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('google_ads_lotes')
      .select('lote_id')
      .eq('lote_id', lote.lote_id)
      .eq('parte', lote.parte)
      .maybeSingle<{ lote_id: string }>();
    if (error) throw errorDeBase(error);
    return data !== null;
  }

  /** La parte 1 abre el lote con la hora actual; las demás usan su sello. */
  private async selloDelLote(lote: LoteGoogleAds): Promise<string> {
    if (lote.parte === 1) return new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('google_ads_lotes')
      .select('sello')
      .eq('lote_id', lote.lote_id)
      .eq('parte', 1)
      .maybeSingle<{ sello: string }>();
    if (error) throw errorDeBase(error);
    if (!data) {
      throw new BadRequestException('Falta la parte 1 de este lote.');
    }
    return data.sello;
  }

  private async limpiarVentana(
    lote: LoteGoogleAds,
    destino: DestinoReporte,
    sello: string,
  ): Promise<void> {
    const borrar = this.supabase
      .getClient()
      .from(destino.tabla)
      .delete()
      .lt(destino.sello, sello);
    const { error } = destino.conFecha
      ? await borrar.gte('fecha', lote.desde as string).lte('fecha', lote.hasta)
      : await borrar;
    if (error) throw errorDeBase(error);
  }

  private async guardar(
    destino: DestinoReporte,
    filas: FilaGoogleAds[],
    sello: string,
  ): Promise<void> {
    for (let i = 0; i < filas.length; i += LOTE_GUARDADO) {
      const tanda = filas
        .slice(i, i + LOTE_GUARDADO)
        .map((f) => ({ ...f, [destino.sello]: sello }));
      const { error } = await this.supabase
        .getClient()
        .from(destino.tabla)
        .upsert(tanda, { onConflict: destino.conflicto });
      if (error) throw errorDeBase(error);
    }
  }

  private async registrar(
    lote: LoteGoogleAds,
    filas: number,
    sello: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('google_ads_lotes')
      .insert({
        lote_id: lote.lote_id,
        parte: lote.parte,
        total_partes: lote.total_partes,
        reporte: lote.reporte,
        desde: lote.desde,
        hasta: lote.hasta,
        filas,
        version: lote.version,
        sello,
      });
    if (error) throw errorDeBase(error);
  }
}
