import { DIAS_POR_SEMANA, LARGO_FECHA, MS_POR_DIA } from '../common/tiempo';
import type { FilaCampanaDia, MetricasBaseFila } from './google-ads.tipos';

/**
 * Cálculo puro del tablero de Google Ads (sin Nest). Las tasas salen como
 * fracción (0..1) y null cuando el denominador es 0: nunca se inventa un 0%.
 */

/** Muestra mínima antes de dar un veredicto sobre una tasa. */
export const MIN_IMPRESIONES_CTR = 200;
export const MIN_CLICS_CVR = 30;
export const MIN_CONVERSIONES_CPA = 5;

// Google reporta "<10%" como 0,0999 y ">90%" como 0,9001.
const IS_ACOTADA_INFERIOR = 0.0999;
const IS_ACOTADA_SUPERIOR = 0.9001;
const BASE_DECIMAL = 10;
const DECIMALES_TASA = 4;
// z de un intervalo de confianza del 95%.
const Z_95 = 1.96;
const DOS = 2;
const CUATRO = 4;

export interface MetricasDto {
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  cpa: number | null;
  /** Hay datos suficientes para leer la tasa sin que sea ruido. */
  muestra: { ctr: boolean; cvr: boolean; cpa: boolean };
}

export interface CuotaImpresionesDto {
  busqueda: number | null;
  perdida_presupuesto: number | null;
  perdida_ranking: number | null;
  superior: number | null;
  superior_absoluta: number | null;
  /** Algún día vino como "<10%": la cifra real puede ser menor. */
  acotada_inferior: boolean;
  /** Algún día vino como ">90%": la cifra real puede ser mayor. */
  acotada_superior: boolean;
}

export function dividir(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

export function redondear(n: number, decimales = 2): number {
  const factor = BASE_DECIMAL ** decimales;
  return Math.round(n * factor) / factor;
}

export function base(): MetricasBaseFila {
  return { gasto: 0, impresiones: 0, clics: 0, conversiones: 0 };
}

export function acumular(
  total: MetricasBaseFila,
  fila: MetricasBaseFila,
): MetricasBaseFila {
  total.gasto += Number(fila.gasto);
  total.impresiones += Number(fila.impresiones);
  total.clics += Number(fila.clics);
  total.conversiones += Number(fila.conversiones);
  return total;
}

export function sumar(filas: MetricasBaseFila[]): MetricasBaseFila {
  return filas.reduce(acumular, base());
}

export function derivar(m: MetricasBaseFila): MetricasDto {
  const tasa = (n: number | null): number | null =>
    n === null ? null : redondear(n, DECIMALES_TASA);
  return {
    gasto: redondear(m.gasto, 0),
    impresiones: m.impresiones,
    clics: m.clics,
    conversiones: redondear(m.conversiones),
    ctr: tasa(dividir(m.clics, m.impresiones)),
    cpc: tasa(dividir(m.gasto, m.clics)),
    cvr: tasa(dividir(m.conversiones, m.clics)),
    cpa: tasa(dividir(m.gasto, m.conversiones)),
    muestra: {
      ctr: m.impresiones >= MIN_IMPRESIONES_CTR,
      cvr: m.clics >= MIN_CLICS_CVR,
      cpa: m.conversiones >= MIN_CONVERSIONES_CPA,
    },
  };
}

/** Agrupa filas por una llave y suma sus métricas. */
export function agruparMetricas<T extends MetricasBaseFila>(
  filas: T[],
  llave: (f: T) => string,
): Map<string, { primera: T; total: MetricasBaseFila }> {
  const grupos = new Map<string, { primera: T; total: MetricasBaseFila }>();
  for (const f of filas) {
    const k = llave(f);
    const g = grupos.get(k) ?? { primera: f, total: base() };
    acumular(g.total, f);
    grupos.set(k, g);
  }
  return grupos;
}

interface Ponderado {
  elegibles: number;
  suma: number;
}

/**
 * Cuota de impresiones del período, ponderada por las impresiones elegibles
 * de cada día (impresiones ÷ cuota). Un promedio simple de porcentajes
 * diarios pesaría igual un día de 5 impresiones que uno de 500.
 */
export function cuotaImpresiones(filas: FilaCampanaDia[]): CuotaImpresionesDto {
  const campos = [
    'is_perdida_presupuesto',
    'is_perdida_ranking',
    'is_superior',
    'is_superior_absoluta',
  ] as const;
  const acum = new Map<string, Ponderado>();
  let impresiones = 0;
  let elegiblesTotal = 0;
  for (const f of filas) {
    const is = f.is_busqueda === null ? null : Number(f.is_busqueda);
    if (!is || is <= 0) continue;
    const elegibles = Number(f.impresiones) / is;
    impresiones += Number(f.impresiones);
    elegiblesTotal += elegibles;
    for (const c of campos) {
      const valor = new Map(Object.entries(f)).get(c) as number | null;
      if (valor === null || valor === undefined) continue;
      const p = acum.get(c) ?? { elegibles: 0, suma: 0 };
      p.elegibles += elegibles;
      p.suma += elegibles * Number(valor);
      acum.set(c, p);
    }
  }
  const ponderada = (c: string): number | null => {
    const p = acum.get(c);
    return p ? redondear(p.suma / p.elegibles, DECIMALES_TASA) : null;
  };
  const valores = filas.map((f) => Number(f.is_busqueda));
  return {
    busqueda:
      elegiblesTotal > 0
        ? redondear(impresiones / elegiblesTotal, DECIMALES_TASA)
        : null,
    perdida_presupuesto: ponderada('is_perdida_presupuesto'),
    perdida_ranking: ponderada('is_perdida_ranking'),
    superior: ponderada('is_superior'),
    superior_absoluta: ponderada('is_superior_absoluta'),
    acotada_inferior: valores.includes(IS_ACOTADA_INFERIOR),
    acotada_superior: valores.includes(IS_ACOTADA_SUPERIOR),
  };
}

// ---------------------------------------------------------------- fechas

function aUtc(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

export function sumarDias(dia: string, dias: number): string {
  return new Date(aUtc(dia) + dias * MS_POR_DIA)
    .toISOString()
    .slice(0, LARGO_FECHA);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA) + 1;
}

/** Ventana de igual duración que termina el día antes de `desde`. */
export function rangoAnterior(
  desde: string,
  hasta: string,
): { desde: string; hasta: string } {
  const dias = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
}

export function enRango(dia: string, desde: string, hasta: string): boolean {
  return dia >= desde && dia <= hasta;
}

/** Lunes = 0 … domingo = 6, para el mapa de calor. */
export function diaSemana(dia: string): number {
  const domingoCero = new Date(aUtc(dia)).getUTCDay();
  return (domingoCero + DIAS_POR_SEMANA - 1) % DIAS_POR_SEMANA;
}

/** Cada día del rango, para que los días sin gasto salgan en 0 en la serie. */
export function recorrerDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

// ---------------------------------------------------------------- marca

/** "Horebs", "horébs" y "pizzeria horebs" son búsquedas de marca. */
export function esMarca(termino: string): boolean {
  return termino
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .includes('horebs');
}

/** Límite inferior de Wilson (95%) de una tasa: cuánto vale como mínimo con esta muestra. */
export function wilsonInferior(exitos: number, total: number): number | null {
  if (total <= 0) return null;
  const z = Z_95;
  const p = exitos / total;
  const z2 = z * z;
  const centro = p + z2 / (DOS * total);
  const margen = z * Math.sqrt((p * (1 - p) + z2 / (CUATRO * total)) / total);
  return redondear(
    Math.max(0, (centro - margen) / (1 + z2 / total)),
    DECIMALES_TASA,
  );
}
