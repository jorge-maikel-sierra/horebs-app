import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REINTENTOS = 2;
const BACKOFF_MS = [500, 1500];

interface AccionGraph {
  action_type: string;
  value: string;
}

interface FilaInsightsGraph {
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: AccionGraph[];
  action_values?: AccionGraph[];
  purchase_roas?: AccionGraph[];
  date_start?: string;
  date_stop?: string;
}

interface RespuestaInsightsCuenta {
  data: FilaInsightsGraph[];
}

interface CampanaGraph {
  id: string;
  name: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: { data: FilaInsightsGraph[] };
}

interface RespuestaCampanas {
  data: CampanaGraph[];
  paging?: { next?: string };
}

export interface PuntoGastoDiario {
  fecha: string;
  gasto: number;
}

export interface ResumenCuentaMetaAds {
  moneda: string;
  gastoHoy: number;
  impresionesHoy: number;
  clicsHoy: number;
  cpcHoy: number | null;
  cpmHoy: number | null;
  ctrHoy: number | null;
  comprasHoy: number;
  valorComprasHoy: number;
  roasHoy: number | null;
  serieUltimos7Dias: PuntoGastoDiario[];
}

export interface CampanaMetaAds {
  campanaId: string;
  nombre: string;
  estado: string;
  presupuestoDiario: number | null;
  presupuestoTotal: number | null;
  gastoHoy: number;
  impresionesHoy: number;
  clicsHoy: number;
  cpcHoy: number | null;
  cpmHoy: number | null;
  ctrHoy: number | null;
  comprasHoy: number;
  valorComprasHoy: number;
}

/** Busca omni_purchase primero (cuenta web+app+offline vía CAPI) y cae a
 * purchase si Meta no lo devuelve — mismo criterio en actions/action_values. */
function buscarValorAccion(acciones: AccionGraph[] | undefined): number {
  if (!acciones) return 0;
  const encontrada =
    acciones.find((a) => a.action_type === 'omni_purchase') ??
    acciones.find((a) => a.action_type === 'purchase');
  return encontrada ? Number(encontrada.value) : 0;
}

function aNumeroONull(valor: string | undefined): number | null {
  return valor != null ? Number(valor) : null;
}

/**
 * Cliente de solo lectura para la Marketing API de Meta (permiso
 * ads_read) — nunca crea, pausa ni edita campañas ni presupuestos, a
 * propósito. Ver apps/api/src/publicidad/README.md para cómo generar el
 * token.
 */
@Injectable()
export class MetaAdsGraphService {
  private readonly logger = new Logger(MetaAdsGraphService.name);
  private readonly version: string;
  private readonly adAccountId?: string;
  private readonly accessToken?: string;

  constructor(private readonly config: ConfigService) {
    this.version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    this.adAccountId = this.config.get<string>('META_AD_ACCOUNT_ID');
    this.accessToken = this.config.get<string>('META_ADS_ACCESS_TOKEN');

    if (!this.adAccountId || !this.accessToken) {
      this.logger.warn(
        'META_AD_ACCOUNT_ID o META_ADS_ACCESS_TOKEN no configuradas — el snapshot de Meta Ads no puede correr.',
      );
    }
  }

  estaConfigurado(): boolean {
    return Boolean(this.adAccountId && this.accessToken);
  }

  async obtenerMoneda(): Promise<string> {
    this.asegurarConfigurado();
    const { currency } = await this.conReintentos(() =>
      this.fetchGraph<{ currency: string }>(`act_${this.adAccountId}?fields=currency`),
    );
    return currency;
  }

  async obtenerResumenCuenta(): Promise<Omit<ResumenCuentaMetaAds, 'moneda'>> {
    this.asegurarConfigurado();
    const params = new URLSearchParams({
      level: 'account',
      date_preset: 'last_7d',
      time_increment: '1',
      fields: 'spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,purchase_roas,date_start,date_stop',
    });
    const { data } = await this.conReintentos(() =>
      this.fetchGraph<RespuestaInsightsCuenta>(`act_${this.adAccountId}/insights?${params}`),
    );

    const serieUltimos7Dias = data.map((fila) => ({
      fecha: fila.date_start ?? '',
      gasto: fila.spend ? Number(fila.spend) : 0,
    }));

    const hoy = data[data.length - 1];
    const gastoHoy = hoy?.spend ? Number(hoy.spend) : 0;
    const valorComprasHoy = buscarValorAccion(hoy?.action_values);

    let roasHoy = aNumeroONull(
      hoy?.purchase_roas?.find((a) => a.action_type === 'omni_purchase')?.value ??
        hoy?.purchase_roas?.find((a) => a.action_type === 'purchase')?.value,
    );
    if (roasHoy === null && gastoHoy > 0) {
      roasHoy = valorComprasHoy / gastoHoy;
    }

    return {
      gastoHoy,
      impresionesHoy: hoy?.impressions ? Number(hoy.impressions) : 0,
      clicsHoy: hoy?.clicks ? Number(hoy.clicks) : 0,
      cpcHoy: aNumeroONull(hoy?.cpc),
      cpmHoy: aNumeroONull(hoy?.cpm),
      ctrHoy: aNumeroONull(hoy?.ctr),
      comprasHoy: buscarValorAccion(hoy?.actions),
      valorComprasHoy,
      roasHoy,
      serieUltimos7Dias,
    };
  }

  /**
   * Paginado defensivo por paging.next (URL absoluta que devuelve Graph
   * API) — poco probable que una cuenta de esta escala supere una página,
   * pero no se asume.
   */
  async obtenerCampanasActivas(): Promise<CampanaMetaAds[]> {
    this.asegurarConfigurado();
    const campanas: CampanaMetaAds[] = [];
    const fields =
      'id,name,effective_status,daily_budget,lifetime_budget,insights.date_preset(today){spend,impressions,clicks,cpc,cpm,ctr,actions,action_values}';
    let siguiente: string | undefined =
      `act_${this.adAccountId}/campaigns?effective_status=${encodeURIComponent('["ACTIVE"]')}&fields=${encodeURIComponent(fields)}&limit=100`;

    while (siguiente) {
      const respuesta: RespuestaCampanas = await this.conReintentos(() =>
        this.fetchGraph<RespuestaCampanas>(siguiente!),
      );
      for (const campana of respuesta.data ?? []) {
        const fila = campana.insights?.data?.[0];
        campanas.push({
          campanaId: campana.id,
          nombre: campana.name,
          estado: campana.effective_status,
          presupuestoDiario: aNumeroONull(campana.daily_budget),
          presupuestoTotal: aNumeroONull(campana.lifetime_budget),
          gastoHoy: fila?.spend ? Number(fila.spend) : 0,
          impresionesHoy: fila?.impressions ? Number(fila.impressions) : 0,
          clicsHoy: fila?.clicks ? Number(fila.clicks) : 0,
          cpcHoy: aNumeroONull(fila?.cpc),
          cpmHoy: aNumeroONull(fila?.cpm),
          ctrHoy: aNumeroONull(fila?.ctr),
          comprasHoy: buscarValorAccion(fila?.actions),
          valorComprasHoy: buscarValorAccion(fila?.action_values),
        });
      }
      siguiente = respuesta.paging?.next;
    }

    return campanas;
  }

  private asegurarConfigurado(): void {
    if (!this.adAccountId || !this.accessToken) {
      throw new Error('Meta Ads no está configurado.');
    }
  }

  private async fetchGraph<T>(urlOPath: string): Promise<T> {
    const url = urlOPath.startsWith('http')
      ? urlOPath
      : `https://graph.facebook.com/${this.version}/${urlOPath}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Meta Marketing API respondió ${res.status}: ${cuerpo}`);
    }
    return res.json() as Promise<T>;
  }

  private async conReintentos<T>(accion: () => Promise<T>): Promise<T> {
    let ultimoError: unknown;
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        return await accion();
      } catch (err) {
        ultimoError = err;
        if (intento < REINTENTOS) {
          // intento es un contador interno del for (0..REINTENTOS), nunca
          // input externo — no hay injection posible acá.
          await new Promise((resolve) =>
            // eslint-disable-next-line security/detect-object-injection
            setTimeout(resolve, BACKOFF_MS[intento]),
          );
        }
      }
    }
    this.logger.error(
      `Falló la consulta a Meta Ads tras ${REINTENTOS + 1} intentos: ${(ultimoError as Error).message}`,
    );
    throw ultimoError;
  }
}
