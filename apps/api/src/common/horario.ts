// Horario del negocio y del bot, en hora de Bogotá (Colombia no tiene
// horario de verano: el offset es siempre -05:00).
// - El local atiende de 4:00 p.m. a 11:00 p.m. (CLAUDE.md).
// - El bot toma pedidos de 11:00 a.m. a 11:00 p.m.: lo que entra antes de
//   las 4:00 p.m. es una reserva con franja (confirmado 2026-10-27).
import { MINUTOS_POR_HORA, MS_POR_HORA } from './tiempo';

const OFFSET_BOGOTA = '-05:00';
const HORA_INICIO_PEDIDOS_BOT = 11;
const HORA_APERTURA = 16;
const HORA_CIERRE = 23;
const INICIO_PEDIDOS_BOT = HORA_INICIO_PEDIDOS_BOT * MINUTOS_POR_HORA;
export const APERTURA = HORA_APERTURA * MINUTOS_POR_HORA;
export const CIERRE = HORA_CIERRE * MINUTOS_POR_HORA;
const HORAS_EN_RELOJ = 12;
const DIGITOS_HORA = 2;
const PASO_FRANJA = 30;
// Margen mínimo para preparar: una franja tiene que estar al menos a 45 min.
const MARGEN_PREPARACION = 45;
// Una lista de WhatsApp admite 10 filas como máximo.
const MAX_FRANJAS = 10;

export type EstadoAtencion = 'cerrado' | 'reservas' | 'abierto';

export interface FranjaEntrega {
  /** 'ya' o 'HH:MM' — va en el id del botón (ck:hora:<id>). */
  id: string;
  titulo: string;
  /** ISO con offset de Bogotá; null = lo antes posible. */
  programadoPara: string | null;
}

const RELOJ = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const FECHA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

/** Minutos desde la medianoche en Bogotá. */
export function minutosBogota(ahora: Date): number {
  const [h, m] = RELOJ.format(ahora).split(':').map(Number);
  return h * MINUTOS_POR_HORA + m;
}

/** YYYY-MM-DD en Bogotá. */
export function fechaBogota(ahora: Date): string {
  return FECHA.format(ahora);
}

export function estadoAtencion(ahora: Date): EstadoAtencion {
  const minutos = minutosBogota(ahora);
  if (minutos < INICIO_PEDIDOS_BOT || minutos >= CIERRE) return 'cerrado';
  return minutos < APERTURA ? 'reservas' : 'abierto';
}

export function dosDigitos(n: number): string {
  return String(n).padStart(DIGITOS_HORA, '0');
}

/** Primer instante del día `AAAA-MM-DD` en Bogotá, como ISO con offset. */
export function inicioDiaBogota(fecha: string): string {
  return `${fecha}T00:00:00.000${OFFSET_BOGOTA}`;
}

/** Último instante del día `AAAA-MM-DD` en Bogotá, como ISO con offset. */
export function finDiaBogota(fecha: string): string {
  return `${fecha}T23:59:59.999${OFFSET_BOGOTA}`;
}

/** Instante (ISO) de hace `horas` horas: para filtrar "lo reciente" en la base. */
export function haceHoras(horas: number, ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - horas * MS_POR_HORA).toISOString();
}

/** 1110 → "6:30 p.m." */
export function etiquetaMinutos(minutos: number): string {
  const h24 = Math.floor(minutos / MINUTOS_POR_HORA);
  const h12 =
    h24 % HORAS_EN_RELOJ === 0 ? HORAS_EN_RELOJ : h24 % HORAS_EN_RELOJ;
  return `${h12}:${dosDigitos(minutos % MINUTOS_POR_HORA)} ${h24 < HORAS_EN_RELOJ ? 'a.m.' : 'p.m.'}`;
}

/** "2026-10-28T18:30:00-05:00" → "6:30 p.m." */
export function etiquetaHora(iso: string): string {
  return etiquetaMinutos(minutosBogota(new Date(iso)));
}

/**
 * Franjas que se le ofrecen al cliente: "Lo antes posible" solo con el
 * local abierto, y después cada 30 min desde las 4:00 p.m. (o desde ahora
 * + 45 min) hasta las 10:30 p.m. Vacío si el bot no está tomando pedidos.
 */
export function franjasEntrega(ahora: Date): FranjaEntrega[] {
  const estado = estadoAtencion(ahora);
  if (estado === 'cerrado') return [];
  const franjas: FranjaEntrega[] = [];
  if (estado === 'abierto') {
    franjas.push({
      id: 'ya',
      titulo: 'Lo antes posible',
      programadoPara: null,
    });
  }
  const fecha = fechaBogota(ahora);
  const minimo = minutosBogota(ahora) + MARGEN_PREPARACION;
  const desde = Math.max(
    APERTURA,
    Math.ceil(minimo / PASO_FRANJA) * PASO_FRANJA,
  );
  for (
    let t = desde;
    t <= CIERRE - PASO_FRANJA && franjas.length < MAX_FRANJAS;
    t += PASO_FRANJA
  ) {
    const hhmm = `${dosDigitos(Math.floor(t / MINUTOS_POR_HORA))}:${dosDigitos(t % MINUTOS_POR_HORA)}`;
    franjas.push({
      id: hhmm,
      titulo: etiquetaMinutos(t),
      programadoPara: `${fecha}T${hhmm}:00${OFFSET_BOGOTA}`,
    });
  }
  return franjas;
}

/** ¿La franja elegida sigue disponible ahora? (puede vencer mientras el cliente decide) */
export function franjaVigente(id: string, ahora: Date): FranjaEntrega | null {
  return franjasEntrega(ahora).find((f) => f.id === id) ?? null;
}
