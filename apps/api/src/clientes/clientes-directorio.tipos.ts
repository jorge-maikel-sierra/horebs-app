export type SegmentoCliente =
  'todos' | 'recurrentes' | 'nuevos' | 'sin_pedidos' | 'con_puntos';

export type OrdenCliente =
  'auto' | 'recientes' | 'nombre' | 'pedidos' | 'gasto' | 'puntos' | 'ultimo';

export interface ClienteDirectorioDto {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
  created_at: string;
  puntos_actuales: number;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
}

/** Totales de toda la base, sin filtros. */
export interface ResumenDirectorio {
  clientes: number;
  con_pedidos: number;
  nuevos_30d: number;
  puntos_total: number;
}

export interface DirectorioClientesDto {
  items: ClienteDirectorioDto[];
  /** Clientes que cumplen la búsqueda y el segmento. */
  total: number;
  pagina: number;
  por_pagina: number;
  paginas: number;
  resumen: ResumenDirectorio;
  /** Cuántos clientes hay por segmento con la búsqueda actual (el segmento no se aplica a sí mismo). */
  conteos: Record<SegmentoCliente, number>;
}

export interface ConsultaDirectorio {
  /** `directorio` pide la vista con segmentos, orden y paginación. */
  vista?: string;
  q?: string;
  segmento?: string;
  orden?: string;
  pagina?: string | number;
  por_pagina?: string | number;
}

/** Fila en memoria: el DTO público más los campos ya plegados para buscar. */
export interface FilaDirectorio extends ClienteDirectorioDto {
  _nombre: string;
  _telefono: string;
  _direccion: string;
  _correo: string;
  _cedula: string;
  _creado: number;
}

export interface Coincidencia {
  fila: FilaDirectorio;
  puntos: number;
}

export interface FilaClienteDirectorio {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
  created_at: string;
  puntos_actuales: number | null;
}

export interface FilaPedidoDirectorio {
  cliente_id: string | null;
  total: number;
  created_at: string;
}

export interface MetricasCliente {
  n: number;
  gastado: number;
  ultimo: string | null;
}

export const CLIENTE_DIRECTORIO_SELECT =
  'id, nombre, apellido, telefono, direccion, correo, cedula, created_at, puntos_actuales';

export const PEDIDO_DIRECTORIO_SELECT = 'cliente_id, total, created_at';
