/**
 * Marketing API de Meta: gasto, alcance y mensajes diarios por anuncio, más
 * el creativo de cada uno. Puro: arma las URLs y convierte las respuestas; el
 * servicio hace las llamadas y guarda.
 */
const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const CAMPOS_INSIGHTS =
  'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,reach,clicks,frequency,actions';
// Se probó contra la cuenta real: esta es la acción de "conversación iniciada".
export const ACCION_CONVERSACION =
  'onsite_conversion.messaging_conversation_started_7d';
export const ACCION_CLIC_ENLACE = 'link_click';
const FILAS_POR_PAGINA = 500;
const FILAS_CREATIVOS = 200;
const LADO_MINIATURA = 240;

/** Meta ajusta las cifras de los últimos días: cada corrida repite este margen. */
export const DIAS_REPASO_META = 3;
/** Histórico inicial al sincronizar a mano sin fecha. */
export const DIAS_HISTORICO_META = 30;

export interface AccionMeta {
  action_type?: string;
  value?: string;
}

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
  frequency?: string;
  actions?: AccionMeta[];
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
  frecuencia: number;
  conversaciones: number;
  clics_enlace: number;
}

export interface AnuncioMeta {
  id?: string;
  name?: string;
  effective_status?: string;
  creative?: { thumbnail_url?: string; title?: string; body?: string };
}

export interface FilaCreativo {
  anuncio_id: string;
  nombre: string | null;
  estado: string | null;
  miniatura_url: string | null;
  titulo: string | null;
  texto: string | null;
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

/** Primera página de anuncios con su creativo (miniatura, título y texto). */
export function urlCreativos(cuenta: string): string {
  const campos = `id,name,effective_status,creative.thumbnail_width(${LADO_MINIATURA}).thumbnail_height(${LADO_MINIATURA}){thumbnail_url,title,body}`;
  const parametros = new URLSearchParams({
    fields: campos,
    limit: String(FILAS_CREATIVOS),
  });
  return `${GRAPH_URL}/${cuentaPublicitaria(cuenta)}/ads?${parametros.toString()}`;
}

function numero(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function entero(valor: string | undefined): number {
  return Math.round(numero(valor));
}

/** Suma el valor de un tipo de acción (Meta lo devuelve como texto, o no lo devuelve). */
export function valorAccion(
  acciones: AccionMeta[] | undefined,
  tipo: string,
): number {
  return (acciones ?? [])
    .filter((a) => a.action_type === tipo)
    .reduce((suma, a) => suma + entero(a.value), 0);
}

/** null si el renglón no trae lo mínimo para guardarlo (fecha, anuncio y campaña). */
export function filaDeInsight(insight: InsightMeta): FilaAnuncioDiario | null {
  const { date_start: fecha, ad_id: anuncio, campaign_id: campana } = insight;
  if (!fecha || !anuncio || !campana) return null;
  return {
    fecha,
    anuncio_id: anuncio,
    anuncio_nombre: insight.ad_name ?? null,
    campana_id: campana,
    campana_nombre: insight.campaign_name ?? null,
    gasto: numero(insight.spend),
    impresiones: entero(insight.impressions),
    alcance: entero(insight.reach),
    clics: entero(insight.clicks),
    frecuencia: numero(insight.frequency),
    conversaciones: valorAccion(insight.actions, ACCION_CONVERSACION),
    clics_enlace: valorAccion(insight.actions, ACCION_CLIC_ENLACE),
  };
}

export function filasDeInsights(insights: InsightMeta[]): FilaAnuncioDiario[] {
  return insights
    .map(filaDeInsight)
    .filter((f): f is FilaAnuncioDiario => f !== null);
}

export function filaDeCreativo(anuncio: AnuncioMeta): FilaCreativo | null {
  if (!anuncio.id) return null;
  return {
    anuncio_id: anuncio.id,
    nombre: anuncio.name ?? null,
    estado: anuncio.effective_status ?? null,
    miniatura_url: anuncio.creative?.thumbnail_url ?? null,
    titulo: anuncio.creative?.title ?? null,
    texto: anuncio.creative?.body ?? null,
  };
}

export function filasDeCreativos(anuncios: AnuncioMeta[]): FilaCreativo[] {
  return anuncios
    .map(filaDeCreativo)
    .filter((f): f is FilaCreativo => f !== null);
}
