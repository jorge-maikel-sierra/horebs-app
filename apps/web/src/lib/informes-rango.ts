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
