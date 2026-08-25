// Duplicado a propósito en apps/api/src/nomina/semana-utils.ts — este
// monorepo no tiene un paquete compartido entre apps/api y apps/web (mismo
// criterio ya usado para OFFSET_ZONA_HORARIA en informes.service.ts).
//
// El negocio opera en hora de Bogotá — usar new Date() directo daría el
// día en UTC, que ya es "mañana" desde ~7pm hora local en adelante.
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export interface RangoSemana {
  inicio: string;
  fin: string;
}

/** Semana lunes-domingo que contiene la fecha dada (formato YYYY-MM-DD). */
export function calcularSemana(fechaYMD: string): RangoSemana {
  const [anio, mes, dia] = fechaYMD.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const diaSemana = fecha.getUTCDay(); // 0=domingo .. 6=sábado
  const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const inicio = new Date(fecha);
  inicio.setUTCDate(inicio.getUTCDate() + offsetLunes);
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 6);

  return { inicio: formatearYMD(inicio), fin: formatearYMD(fin) };
}

export function sumarDias(fechaYMD: string, dias: number): string {
  const [anio, mes, dia] = fechaYMD.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return formatearYMD(fecha);
}

export function diasDeLaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
}

const DIA_CORTO = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Etiqueta de un día (L, M, M, J, V, S, D) a partir de su posición 0-6 dentro de la semana. */
export function etiquetaDia(indice: number): string {
  return DIA_CORTO[indice];
}

/** Formatea una fecha YYYY-MM-DD sin pasar por conversión de zona horaria
 * (new Date('YYYY-MM-DD') se interpreta en UTC y puede mostrar el día
 * anterior en horario de Bogotá) — se arma el texto directo de las partes. */
export function formatearFechaCorta(fechaYMD: string): string {
  const [, mes, dia] = fechaYMD.split('-').map(Number);
  const MES_CORTO = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return `${dia} ${MES_CORTO[mes - 1]}`;
}

function formatearYMD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Fecha YYYY-MM-DD en horario de Bogotá a partir de un timestamptz — nunca
 * hacer .slice(0, 10) sobre un timestamp crudo (viene en UTC: una liquidación
 * de la noche ya puede estar fechada "mañana" en UTC). */
export function fechaBogotaDesdeISO(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));
}
