import { MS_POR_DIA } from '../common/tiempo';

/** Ventana por defecto del tablero: los últimos 30 días. */
export const DIAS_TABLERO_DEFECTO = 30;

export interface FilaConversacionOrigen {
  origen_fuente: string | null;
  origen_anuncio_id: string | null;
  origen_ref: string | null;
  origen_titulo: string | null;
}

export interface FilaPedidoOrigen {
  origen_fuente: string | null;
  origen_anuncio_id: string | null;
  origen_ref: string | null;
  total: number | string;
  estado: string;
}

export interface RendimientoOrigenDto {
  clave: string;
  tipo: 'anuncio' | 'enlace' | 'otro';
  fuente: string;
  anuncio_id: string | null;
  ref: string | null;
  titulo: string | null;
  conversaciones: number;
  pedidos: number;
  entregados: number;
  cancelados: number;
  /** Suma de los pedidos no cancelados, en pesos. */
  ventas: number;
}

/** Fecha `AAAA-MM-DD` en Bogotá de hace `dias` días. */
export function fechaHaceDias(dias: number, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date(ahora.getTime() - dias * MS_POR_DIA));
}

function claveDe(fila: {
  origen_fuente: string | null;
  origen_anuncio_id: string | null;
  origen_ref: string | null;
}): string {
  if (fila.origen_anuncio_id) return `anuncio:${fila.origen_anuncio_id}`;
  if (fila.origen_ref) return `ref:${fila.origen_ref}`;
  return `fuente:${fila.origen_fuente ?? 'desconocida'}`;
}

function nuevaFila(
  clave: string,
  fila: FilaConversacionOrigen | FilaPedidoOrigen,
): RendimientoOrigenDto {
  const tipo = fila.origen_anuncio_id
    ? 'anuncio'
    : fila.origen_ref
      ? 'enlace'
      : 'otro';
  return {
    clave,
    tipo,
    fuente: fila.origen_fuente ?? 'desconocida',
    anuncio_id: fila.origen_anuncio_id,
    ref: fila.origen_ref,
    titulo: 'origen_titulo' in fila ? fila.origen_titulo : null,
    conversaciones: 0,
    pedidos: 0,
    entregados: 0,
    cancelados: 0,
    ventas: 0,
  };
}

/**
 * Conversaciones (por su primer toque) y pedidos (por el origen que se les
 * copió al crearlos) agrupados por anuncio o por `ref`, de más a menos ventas.
 */
export function rendimientoPorOrigen(
  conversaciones: FilaConversacionOrigen[],
  pedidos: FilaPedidoOrigen[],
): RendimientoOrigenDto[] {
  const filas = new Map<string, RendimientoOrigenDto>();
  const filaDe = (
    fila: FilaConversacionOrigen | FilaPedidoOrigen,
  ): RendimientoOrigenDto => {
    const clave = claveDe(fila);
    const existente = filas.get(clave) ?? nuevaFila(clave, fila);
    filas.set(clave, existente);
    return existente;
  };
  for (const c of conversaciones) {
    const fila = filaDe(c);
    fila.conversaciones += 1;
    fila.titulo = fila.titulo ?? c.origen_titulo;
  }
  for (const p of pedidos) {
    const fila = filaDe(p);
    fila.pedidos += 1;
    if (p.estado === 'cancelado') {
      fila.cancelados += 1;
      continue;
    }
    if (p.estado === 'entregado') fila.entregados += 1;
    fila.ventas += Number(p.total);
  }
  return [...filas.values()].sort(
    (a, b) => b.ventas - a.ventas || b.conversaciones - a.conversaciones,
  );
}
