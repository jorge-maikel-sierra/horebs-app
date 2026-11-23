import { DIAS_POR_SEMANA, LARGO_MES } from '../common/tiempo';
import {
  DECIMALES_TASA,
  dividir,
  redondear,
  sumarDias,
} from './google-ads-metricas';
import type { FilaCampanaDia, FilaEstadoCampana } from './google-ads.tipos';

/**
 * Cruce del gasto de Google Ads con los pedidos reales (puro, sin Nest). La
 * mayoría de los pedidos se cierra por WhatsApp y no trae origen: por eso el
 * tablero muestra primero las cifras combinadas y la cobertura, y el CPA
 * atribuido solo como cota inferior cuando la cobertura es baja.
 */

/** Por debajo de esta cobertura el CPA atribuido es solo una cota. */
export const COBERTURA_MINIMA = 0.3;
/** Días promedio de un mes, para el presupuesto mensual de Google. */
export const DIAS_MES_PROMEDIO = 30.4;

export interface FilaPedidoAds {
  id: string;
  total: number | string;
  estado: string;
  created_at: string;
  origen_fuente: string | null;
  origen_campana_id: string | null;
  atribucion_web: Record<string, string> | null;
}

export interface NegocioDto {
  pedidos: number;
  ventas: number;
  gasto_google: number;
  gasto_meta: number;
  /** Ventas ÷ (gasto Google + Meta). */
  roas_combinado: number | null;
  /** (Gasto Google + Meta) ÷ pedidos. */
  cpa_combinado: number | null;
  clientes_nuevos: number;
  cac_combinado: number | null;
  pedidos_google: number;
  ventas_google: number;
  cpa_google: number | null;
  roas_google: number | null;
  /** Fracción de pedidos con origen conocido. */
  cobertura: number | null;
  /** La cobertura es baja: el CPA de Google es un máximo, no la cifra real. */
  cota_inferior: boolean;
}

export interface RitmoDto {
  mes: string;
  gasto_mes: number;
  presupuesto_diario: number;
  presupuesto_mes: number;
  dias_transcurridos: number;
  dias_mes: number;
  proyeccion: number | null;
  /** Proyección ÷ presupuesto del mes. */
  ritmo: number | null;
}

const FUENTES_GOOGLE = new Set(['google', 'adwords']);
// Un enlace de Google Business Profile también trae utm_source=google, pero
// con utm_medium=organic: solo cuenta como anuncio si el medio es pagado.
const MEDIOS_PAGADOS = new Set(['cpc', 'ppc', 'paid', 'paid_search']);
const CLAVES_CLIC_GOOGLE = ['gclid', 'gbraid', 'wbraid'];
/**
 * La caja guarda la campaña de Google en `pedidos.origen_campana_id` con este
 * prefijo; sin él sería un id de Meta.
 */
export const PREFIJO_CAJA_GOOGLE = 'gads:';

/** El pedido vino de Google Ads: gclid, UTM pagado de Google o la caja. */
export function esPedidoGoogle(p: FilaPedidoAds): boolean {
  const a = new Map(Object.entries(p.atribucion_web ?? {}));
  const texto = (k: string): string => (a.get(k) ?? '').trim().toLowerCase();
  return (
    CLAVES_CLIC_GOOGLE.some((c) => Boolean(a.get(c))) ||
    Boolean(p.origen_campana_id?.startsWith(PREFIJO_CAJA_GOOGLE)) ||
    (FUENTES_GOOGLE.has(texto('utm_source')) &&
      MEDIOS_PAGADOS.has(texto('utm_medium')))
  );
}

/** Se sabe de dónde llegó: UTM, clic de anuncio, origen del bot o la caja. */
export function tieneOrigen(p: FilaPedidoAds): boolean {
  const a = p.atribucion_web ?? {};
  return (
    Boolean(a.utm_source) ||
    CLAVES_CLIC_GOOGLE.some((c) =>
      Boolean(new Map(Object.entries(a)).get(c)),
    ) ||
    Boolean(p.origen_fuente) ||
    Boolean(p.origen_campana_id)
  );
}

export interface EntradaNegocio {
  pedidos: FilaPedidoAds[];
  gastoGoogle: number;
  gastoMeta: number;
  clientesNuevos: number;
}

export function resumenNegocio(e: EntradaNegocio): NegocioDto {
  const vigentes = e.pedidos.filter((p) => p.estado !== 'cancelado');
  const ventas = vigentes.reduce((s, p) => s + Number(p.total), 0);
  const google = vigentes.filter(esPedidoGoogle);
  const ventasGoogle = google.reduce((s, p) => s + Number(p.total), 0);
  const gastoTotal = e.gastoGoogle + e.gastoMeta;
  const cobertura = dividir(
    vigentes.filter(tieneOrigen).length,
    vigentes.length,
  );
  const r = (n: number | null): number | null =>
    n === null ? null : redondear(n);
  return {
    pedidos: vigentes.length,
    ventas: redondear(ventas, 0),
    gasto_google: redondear(e.gastoGoogle, 0),
    gasto_meta: redondear(e.gastoMeta, 0),
    roas_combinado: r(dividir(ventas, gastoTotal)),
    cpa_combinado: r(dividir(gastoTotal, vigentes.length)),
    clientes_nuevos: e.clientesNuevos,
    cac_combinado: r(dividir(gastoTotal, e.clientesNuevos)),
    pedidos_google: google.length,
    ventas_google: redondear(ventasGoogle, 0),
    cpa_google: r(dividir(e.gastoGoogle, google.length)),
    roas_google: r(dividir(ventasGoogle, e.gastoGoogle)),
    cobertura: cobertura === null ? null : redondear(cobertura, DECIMALES_TASA),
    cota_inferior: cobertura === null || cobertura < COBERTURA_MINIMA,
  };
}

function redondearOpcional(n: number | null): number | null {
  return n === null ? null : redondear(n, DECIMALES_TASA);
}

function diasDelMes(mes: string): number {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
}

/**
 * Ritmo del mes de `hasta`: gasto acumulado frente a 30,4 × presupuesto
 * diario. Google puede gastar hasta el doble del diario en un día y
 * compensarlo en el mes, así que el diario solo no dice si se va a pasar.
 */
export function ritmoDelMes(
  filas: FilaCampanaDia[],
  hasta: string,
  estados: FilaEstadoCampana[] = [],
): RitmoDto {
  const mes = hasta.slice(0, LARGO_MES);
  const delMes = filas.filter(
    (f) => f.fecha.startsWith(mes) && f.fecha <= hasta,
  );
  const gastoMes = delMes.reduce((s, f) => s + Number(f.gasto), 0);
  const presupuestoDiario =
    estados.length > 0
      ? estados
          .filter((e) => e.estado === 'ENABLED')
          .reduce((t, e) => t + Number(e.presupuesto_diario), 0)
      : presupuestoVigente(filas, hasta);
  const presupuestoMes = presupuestoDiario * DIAS_MES_PROMEDIO;
  const diasMes = diasDelMes(mes);
  const transcurridos = Number(hasta.slice(LARGO_MES + 1));
  const proyeccion = dividir(gastoMes * diasMes, transcurridos);
  return {
    mes,
    gasto_mes: redondear(gastoMes, 0),
    presupuesto_diario: redondear(presupuestoDiario, 0),
    presupuesto_mes: redondear(presupuestoMes, 0),
    dias_transcurridos: transcurridos,
    dias_mes: diasMes,
    proyeccion: proyeccion === null ? null : redondear(proyeccion, 0),
    ritmo: redondearOpcional(dividir(proyeccion ?? 0, presupuestoMes)),
  };
}

/** Suma del último presupuesto diario de cada campaña activa (últimos 7 días). */
export function presupuestoVigente(
  filas: FilaCampanaDia[],
  hasta: string,
): number {
  const desde = sumarDias(hasta, -DIAS_POR_SEMANA);
  const ultimo = new Map<string, FilaCampanaDia>();
  for (const f of filas) {
    if (f.fecha < desde || f.fecha > hasta) continue;
    const previo = ultimo.get(f.campana_id);
    if (!previo || f.fecha > previo.fecha) ultimo.set(f.campana_id, f);
  }
  return [...ultimo.values()]
    .filter((f) => f.estado === 'ENABLED')
    .reduce((s, f) => s + Number(f.presupuesto_diario), 0);
}
