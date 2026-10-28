import { BadRequestException } from '@nestjs/common';
import { finDiaBogota, inicioDiaBogota } from '../common/horario';
import type {
  Acumulador,
  Granularidad,
  InformeClienteDiaDto,
  InformeDiaDto,
} from './informes.tipos';

/**
 * El negocio opera en Riohacha (América/Bogotá, UTC-5 fijo, sin horario de
 * verano) pero todos los timestamps se guardan en UTC. El horario de
 * atención (4pm-11pm local) cae entre las 21:00 UTC y las 04:00 UTC del día
 * siguiente — agrupar/filtrar por fecha UTC cruda parte la noche de venta
 * por la mitad y corre pedidos de la noche al día siguiente.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Rangos largos (histórico incluido) no se pueden mostrar barra-por-día
 * sin romper el gráfico — a partir de ~2 meses se agrupa por mes.
 */
export function resolverGranularidad(
  desde: string,
  hasta: string,
): Granularidad {
  return contarDias(desde, hasta) > 62 ? 'mes' : 'dia';
}

export function claveBucket(
  fechaIso: string,
  granularidad: Granularidad,
): string {
  const local = aFechaLocal(fechaIso);
  return granularidad === 'mes' ? local.slice(0, 7) : local.slice(0, 10);
}

export function aFechaLocal(fechaIso: string): string {
  return new Date(new Date(fechaIso).getTime() - OFFSET_MS).toISOString();
}

/**
 * Una entrada por cada día (o mes) entre `desde` y `hasta`, aunque ese día
 * no tenga datos — así la serie no queda con huecos.
 */
export function recorrerFechas<T>(
  desde: string,
  hasta: string,
  granularidad: Granularidad,
  armar: (fecha: string) => T,
): T[] {
  const resultado: T[] = [];
  if (granularidad === 'dia') {
    let cursor = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T00:00:00`);
    while (cursor <= fin) {
      resultado.push(armar(formatearFecha(cursor)));
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  } else {
    let cursor = new Date(`${desde.slice(0, 7)}-01T00:00:00`);
    const fin = new Date(`${hasta.slice(0, 7)}-01T00:00:00`);
    while (cursor <= fin) {
      resultado.push(armar(cursor.toISOString().slice(0, 7)));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return resultado;
}

export function serializarSerie(
  porBucket: Map<string, Acumulador>,
  desde: string,
  hasta: string,
  granularidad: Granularidad,
): InformeDiaDto[] {
  return recorrerFechas(desde, hasta, granularidad, (fecha) => ({
    fecha,
    ...(porBucket.get(fecha) ?? { total: 0, pedidos: 0 }),
  }));
}

export function serializarSerieClientes(
  porBucket: Map<string, number>,
  desde: string,
  hasta: string,
  granularidad: Granularidad,
): InformeClienteDiaDto[] {
  return recorrerFechas(desde, hasta, granularidad, (fecha) => ({
    fecha,
    nuevos: porBucket.get(fecha) ?? 0,
  }));
}

export function resolverRango(desdeInput?: string, hastaInput?: string) {
  const hoyLocal = new Date(aFechaLocal(new Date().toISOString()));
  const hastaDate = hastaInput ? new Date(`${hastaInput}T00:00:00`) : hoyLocal;
  const desdeDate = desdeInput
    ? new Date(`${desdeInput}T00:00:00`)
    : new Date(hastaDate.getTime() - 6 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(desdeDate.getTime()) || Number.isNaN(hastaDate.getTime())) {
    throw new BadRequestException('Rango de fechas inválido.');
  }
  if (desdeDate > hastaDate) {
    throw new BadRequestException(
      'La fecha "desde" no puede ser posterior a "hasta".',
    );
  }

  const desde = formatearFecha(desdeDate);
  const hasta = formatearFecha(hastaDate);
  return {
    desde,
    hasta,
    desdeISO: inicioDiaBogota(desde),
    hastaISO: finDiaBogota(hasta),
  };
}

export function contarDias(desde: string, hasta: string) {
  const ms =
    new Date(`${hasta}T00:00:00`).getTime() -
    new Date(`${desde}T00:00:00`).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export function formatearFecha(d: Date) {
  return d.toISOString().slice(0, 10);
}
