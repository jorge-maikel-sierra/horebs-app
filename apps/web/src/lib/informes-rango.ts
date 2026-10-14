import { sumarDias } from '@/lib/semana';

function aUTC(ymd: string) {
  const [anio, mes, dia] = ymd.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000) + 1;
}

/** Ventana de igual duración que termina el día anterior a `desde`. */
export function rangoAnterior(desde: string, hasta: string) {
  const dias = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
}

const SIN_ANIO = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const CON_ANIO = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function fecha(fmt: Intl.DateTimeFormat, ymd: string) {
  return fmt.format(new Date(`${ymd}T00:00:00Z`)).replace(/\./g, '');
}

export function etiquetaRango(desde: string, hasta: string): string {
  if (!desde || !hasta) return '';
  if (desde === hasta) return fecha(CON_ANIO, hasta);
  return `${fecha(SIN_ANIO, desde)} – ${fecha(CON_ANIO, hasta)}`;
}

export type Delta =
  | { tipo: 'sube' | 'baja'; pct: number }
  | { tipo: 'igual' }
  | { tipo: 'nuevo' };

export function calcularDelta(
  actual: number,
  anterior: number | undefined,
): Delta | null {
  if (anterior === undefined) return null;
  if (anterior === 0) return actual > 0 ? { tipo: 'nuevo' } : { tipo: 'igual' };
  const pct = ((actual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.05) return { tipo: 'igual' };
  return { tipo: pct > 0 ? 'sube' : 'baja', pct: Math.abs(pct) };
}

const PARTES_CORTAS = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const PARTES_MES = new Intl.DateTimeFormat('es-CO', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const MES_LARGO = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function partes(fmt: Intl.DateTimeFormat, fecha: Date, tipos: string[]) {
  return fmt
    .formatToParts(fecha)
    .filter((p) => tipos.includes(p.type))
    .map((p) => p.value.replace(/\./g, ''))
    .join(' ');
}

/** Clave del informe: 'YYYY-MM-DD' (día) o 'YYYY-MM' (mes, vista anual). */
function aFecha(clave: string) {
  return new Date(`${clave.length === 7 ? `${clave}-01` : clave}T00:00:00Z`);
}

/** Etiqueta compacta para el eje X: "8 oct" o "oct 26". */
export function etiquetaCorta(clave: string): string {
  const f = aFecha(clave);
  return clave.length === 7
    ? partes(PARTES_MES, f, ['month', 'year'])
    : partes(PARTES_CORTAS, f, ['day', 'month']);
}

/** Etiqueta completa para tooltip y tabla: "miércoles, 8 de octubre". */
export function etiquetaLarga(clave: string): string {
  const f = aFecha(clave);
  return clave.length === 7 ? MES_LARGO.format(f) : FECHA_LARGA.format(f);
}

const UN_DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const SIN_DECIMALES = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

/** Pesos compactos para ejes y etiquetas: "$ 500 mil", "$ 1,7 M". */
export function formatoEjePesos(n: number): string {
  if (n === 0) return '$ 0';
  if (n >= 1_000_000) return `$ ${UN_DECIMAL.format(n / 1_000_000)} M`;
  if (n >= 1_000) return `$ ${SIN_DECIMALES.format(n / 1_000)} mil`;
  return `$ ${SIN_DECIMALES.format(n)}`;
}
