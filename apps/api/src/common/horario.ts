// Horario del negocio y del bot, en hora de Bogotá (Colombia no tiene
// horario de verano: el offset es siempre -05:00).
// - El local atiende de 4:00 p.m. a 11:00 p.m. (CLAUDE.md).
// - El bot toma pedidos de 11:00 a.m. a 11:00 p.m.: lo que entra antes de
//   las 4:00 p.m. es una reserva con franja (confirmado 2026-10-27).
const OFFSET_BOGOTA = '-05:00';
const INICIO_PEDIDOS_BOT = 11 * 60;
export const APERTURA = 16 * 60;
export const CIERRE = 23 * 60;
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
  return h * 60 + m;
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

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

/** Primer instante del día `AAAA-MM-DD` en Bogotá, como ISO con offset. */
export function inicioDiaBogota(fecha: string): string {
  return `${fecha}T00:00:00.000${OFFSET_BOGOTA}`;
}

/** Último instante del día `AAAA-MM-DD` en Bogotá, como ISO con offset. */
export function finDiaBogota(fecha: string): string {
  return `${fecha}T23:59:59.999${OFFSET_BOGOTA}`;
}

const MINUTOS_POR_HORA = 60;
const MS_POR_MINUTO = 60_000;
const MS_POR_HORA = MINUTOS_POR_HORA * MS_POR_MINUTO;

/** Instante (ISO) de hace `horas` horas: para filtrar "lo reciente" en la base. */
export function haceHoras(horas: number, ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - horas * MS_POR_HORA).toISOString();
}

/** 1110 → "6:30 p.m." */
export function etiquetaMinutos(minutos: number): string {
  const h24 = Math.floor(minutos / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${dosDigitos(minutos % 60)} ${h24 < 12 ? 'a.m.' : 'p.m.'}`;
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
    const hhmm = `${dosDigitos(Math.floor(t / 60))}:${dosDigitos(t % 60)}`;
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
