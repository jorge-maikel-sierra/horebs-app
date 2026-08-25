// Duplicado a propósito en apps/web/src/lib/semana.ts — este monorepo no
// tiene un paquete compartido entre apps/api y apps/web (mismo criterio ya
// usado para OFFSET_ZONA_HORARIA en informes.service.ts).
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

function formatearYMD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
