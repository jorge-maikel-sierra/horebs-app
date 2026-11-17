/**
 * Marketing API de Meta: gasto y alcance diario por anuncio. Puro: arma la URL
 * y convierte la respuesta; el servicio hace la llamada y guarda.
 */
const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const CAMPOS_INSIGHTS =
  'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,reach,clicks';
const FILAS_POR_PAGINA = 500;

/** Meta ajusta las cifras de los últimos días: cada corrida repite este margen. */
export const DIAS_REPASO_META = 3;
/** Histórico inicial al sincronizar a mano sin fecha. */
export const DIAS_HISTORICO_META = 30;

export interface InsightMeta {
  date_start?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
}

export interface FilaAnuncioDiario {
  fecha: string;
  anuncio_id: string;
  anuncio_nombre: string | null;
  campana_id: string;
  campana_nombre: string | null;
  gasto: number;
  impresiones: number;
  alcance: number;
  clics: number;
}

/** El id de la cuenta publicitaria lleva el prefijo `act_`; se acepta con o sin él. */
export function cuentaPublicitaria(id: string): string {
  const limpio = id.trim();
  return limpio.startsWith('act_') ? limpio : `act_${limpio}`;
}

/** Primera página de `insights` a nivel de anuncio, un renglón por día. */
export function urlInsights(
  cuenta: string,
  desde: string,
  hasta: string,
): string {
  const parametros = new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    fields: CAMPOS_INSIGHTS,
    time_range: JSON.stringify({ since: desde, until: hasta }),
    limit: String(FILAS_POR_PAGINA),
  });
  return `${GRAPH_URL}/${cuentaPublicitaria(cuenta)}/insights?${parametros.toString()}`;
}

function entero(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** null si el renglón no trae lo mínimo para guardarlo (fecha, anuncio y campaña). */
export function filaDeInsight(insight: InsightMeta): FilaAnuncioDiario | null {
  const { date_start: fecha, ad_id: anuncio, campaign_id: campana } = insight;
  if (!fecha || !anuncio || !campana) return null;
  const gasto = Number(insight.spend);
  return {
    fecha,
    anuncio_id: anuncio,
    anuncio_nombre: insight.ad_name ?? null,
    campana_id: campana,
    campana_nombre: insight.campaign_name ?? null,
    gasto: Number.isFinite(gasto) ? gasto : 0,
    impresiones: entero(insight.impressions),
    alcance: entero(insight.reach),
    clics: entero(insight.clicks),
  };
}

export function filasDeInsights(insights: InsightMeta[]): FilaAnuncioDiario[] {
  return insights
    .map(filaDeInsight)
    .filter((f): f is FilaAnuncioDiario => f !== null);
}
