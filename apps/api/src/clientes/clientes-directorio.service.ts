import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

export interface DirectorioClientesDto {
  items: ClienteDirectorioDto[];
  /** Clientes que cumplen la búsqueda y el segmento. */
  total: number;
  pagina: number;
  por_pagina: number;
  paginas: number;
  /** Totales de toda la base, sin filtros. */
  resumen: {
    clientes: number;
    con_pedidos: number;
    nuevos_30d: number;
    puntos_total: number;
  };
  /** Cuántos clientes hay por segmento con la búsqueda actual (el segmento no se aplica a sí mismo). */
  conteos: Record<SegmentoCliente, number>;
}

export interface ConsultaDirectorio {
  q?: string;
  segmento?: string;
  orden?: string;
  pagina?: string | number;
  por_pagina?: string | number;
}

interface Fila extends ClienteDirectorioDto {
  _nombre: string;
  _telefono: string;
  _direccion: string;
  _correo: string;
  _cedula: string;
  _creado: number;
}

const TTL_MS = 30_000;
const LOTE = 1000; // tope de filas por consulta de Supabase
const DIAS_NUEVO = 30;
const POR_PAGINA_DEFECTO = 24;
const POR_PAGINA_MAX = 60;
const MAX_TERMINOS = 6;

const SEGMENTOS: SegmentoCliente[] = [
  'todos',
  'recurrentes',
  'nuevos',
  'sin_pedidos',
  'con_puntos',
];
const ORDENES: OrdenCliente[] = [
  'auto',
  'recientes',
  'nombre',
  'pedidos',
  'gasto',
  'puntos',
  'ultimo',
];

/** Minúsculas y sin tildes: "José" y "jose" son lo mismo al buscar. */
function plegar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ES_ALFANUMERICO = /[\p{L}\p{N}]/u;

/** Coincidencia por inicio de palabra: "ana" encuentra "Ana Pérez" pero no "Mediana". */
function coincide(campo: string, v: string): boolean {
  if (!v) return false;
  let i = campo.indexOf(v);
  while (i !== -1) {
    if (i === 0 || !ES_ALFANUMERICO.test(campo[i - 1])) return true;
    i = campo.indexOf(v, i + 1);
  }
  return false;
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Dígitos de un teléfono tecleado, sin el indicativo +57 de Colombia. */
function digitosTelefono(texto: string): string {
  return soloDigitos(texto.trim().replace(/^\+\s*57(?=\D*\d)/, ''));
}

function entero(valor: unknown, defecto: number): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : defecto;
}

@Injectable()
export class ClientesDirectorioService {
  private cache: { expira: number; filas: Fila[] } | null = null;
  private cargando: Promise<Fila[]> | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  /** Se llama al editar o borrar un cliente para que el directorio no muestre datos viejos. */
  invalidar(): void {
    this.cache = null;
  }

  async consultar(
    consulta: ConsultaDirectorio,
  ): Promise<DirectorioClientesDto> {
    const filas = await this.filas();

    const segmento: SegmentoCliente = SEGMENTOS.includes(
      consulta.segmento as SegmentoCliente,
    )
      ? (consulta.segmento as SegmentoCliente)
      : 'todos';
    const orden: OrdenCliente = ORDENES.includes(consulta.orden as OrdenCliente)
      ? (consulta.orden as OrdenCliente)
      : 'auto';
    const porPagina = Math.min(
      POR_PAGINA_MAX,
      Math.max(1, entero(consulta.por_pagina, POR_PAGINA_DEFECTO)),
    );

    const terminos = plegar(consulta.q ?? '')
      .split(/\s+/)
      // "+57" suelto es solo el indicativo de Colombia: no filtra nada.
      .filter((t) => t && t !== '+57')
      .slice(0, MAX_TERMINOS);

    const ahora = Date.now();
    const corteNuevos = ahora - DIAS_NUEVO * 86_400_000;

    const coincidentes: { fila: Fila; puntos: number }[] = [];
    for (const fila of filas) {
      let puntos = 0;
      let ok = true;
      for (const t of terminos) {
        const p = this.puntajeTermino(fila, t);
        if (p === 0) {
          ok = false;
          break;
        }
        puntos += p;
      }
      if (ok) coincidentes.push({ fila, puntos });
    }

    const cumple = (f: Fila, s: SegmentoCliente): boolean => {
      switch (s) {
        case 'recurrentes':
          return f.total_pedidos >= 2;
        case 'nuevos':
          return f._creado >= corteNuevos;
        case 'sin_pedidos':
          return f.total_pedidos === 0;
        case 'con_puntos':
          return f.puntos_actuales > 0;
        default:
          return true;
      }
    };

    const conteos = Object.fromEntries(
      SEGMENTOS.map((s) => [
        s,
        coincidentes.filter(({ fila }) => cumple(fila, s)).length,
      ]),
    ) as Record<SegmentoCliente, number>;

    const filtrados = coincidentes.filter(({ fila }) => cumple(fila, segmento));
    this.ordenar(filtrados, orden, terminos.length > 0);

    const total = filtrados.length;
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    const pagina = Math.min(paginas, Math.max(1, entero(consulta.pagina, 1)));
    const desde = (pagina - 1) * porPagina;

    return {
      items: filtrados
        .slice(desde, desde + porPagina)
        .map(({ fila }) => this.publica(fila)),
      total,
      pagina,
      por_pagina: porPagina,
      paginas,
      resumen: {
        clientes: filas.length,
        con_pedidos: filas.filter((f) => f.total_pedidos > 0).length,
        nuevos_30d: filas.filter((f) => f._creado >= corteNuevos).length,
        puntos_total: filas.reduce((s, f) => s + f.puntos_actuales, 0),
      },
      conteos,
    };
  }

  // ---------------------------------------------------------------------

  /** 0 = no coincide; más alto = mejor coincidencia (nombre > teléfono > resto). */
  private puntajeTermino(f: Fila, t: string): number {
    if (/^[+\d][\d\s().-]*$/.test(t)) {
      const d = digitosTelefono(t);
      if (d.length >= 3) {
        if (f._telefono.includes(d)) return 70;
        if (f._cedula.includes(d)) return 60;
      }
    }
    if (f._nombre.startsWith(t)) return 100;
    if (coincide(f._nombre, t)) return 80;
    if (coincide(f._direccion, t) || coincide(f._correo, t)) return 20;
    return 0;
  }

  private ordenar(
    lista: { fila: Fila; puntos: number }[],
    orden: OrdenCliente,
    hayTexto: boolean,
  ): void {
    const reciente = (a: Fila, b: Fila) => b._creado - a._creado;
    const efectivo: OrdenCliente =
      orden === 'auto' ? (hayTexto ? 'auto' : 'recientes') : orden;
    lista.sort((x, y) => {
      const a = x.fila;
      const b = y.fila;
      switch (efectivo) {
        case 'nombre':
          return a._nombre.localeCompare(b._nombre, 'es') || reciente(a, b);
        case 'pedidos':
          return b.total_pedidos - a.total_pedidos || reciente(a, b);
        case 'gasto':
          return b.total_gastado - a.total_gastado || reciente(a, b);
        case 'puntos':
          return b.puntos_actuales - a.puntos_actuales || reciente(a, b);
        case 'ultimo': {
          // Quien nunca pidió va al final.
          const ua = a.ultimo_pedido ? Date.parse(a.ultimo_pedido) : -1;
          const ub = b.ultimo_pedido ? Date.parse(b.ultimo_pedido) : -1;
          return ub - ua || reciente(a, b);
        }
        case 'auto':
          return y.puntos - x.puntos || reciente(a, b);
        default:
          return reciente(a, b);
      }
    });
  }

  private publica(f: Fila): ClienteDirectorioDto {
    return {
      id: f.id,
      nombre: f.nombre,
      apellido: f.apellido,
      telefono: f.telefono,
      direccion: f.direccion,
      correo: f.correo,
      cedula: f.cedula,
      created_at: f.created_at,
      puntos_actuales: f.puntos_actuales,
      total_pedidos: f.total_pedidos,
      total_gastado: f.total_gastado,
      ultimo_pedido: f.ultimo_pedido,
    };
  }

  /** Cache de 30 s con una sola carga en vuelo: varias personas abriendo la página no multiplican las consultas. */
  private filas(): Promise<Fila[]> {
    if (this.cache && this.cache.expira > Date.now()) {
      return Promise.resolve(this.cache.filas);
    }
    this.cargando ??= this.construir()
      .then((filas) => {
        this.cache = { expira: Date.now() + TTL_MS, filas };
        return filas;
      })
      .finally(() => {
        this.cargando = null;
      });
    return this.cargando;
  }

  private async construir(): Promise<Fila[]> {
    const clientes = await this.traerTodo<{
      id: string;
      nombre: string;
      apellido: string | null;
      telefono: string | null;
      direccion: string | null;
      correo: string | null;
      cedula: string | null;
      created_at: string;
      puntos_actuales: number | null;
    }>(
      'clientes',
      'id, nombre, apellido, telefono, direccion, correo, cedula, created_at, puntos_actuales',
    );
    const pedidos = await this.traerTodo<{
      cliente_id: string | null;
      total: number;
      created_at: string;
    }>('pedidos', 'cliente_id, total, created_at');

    // Mismo criterio que ClientesService.obtenerDetalle: todos los pedidos del cliente.
    const metricas = new Map<
      string,
      { n: number; gastado: number; ultimo: string }
    >();
    for (const p of pedidos) {
      if (!p.cliente_id) continue;
      const m = metricas.get(p.cliente_id);
      if (!m) {
        metricas.set(p.cliente_id, {
          n: 1,
          gastado: p.total,
          ultimo: p.created_at,
        });
      } else {
        m.n += 1;
        m.gastado += p.total;
        if (p.created_at > m.ultimo) m.ultimo = p.created_at;
      }
    }

    return clientes.map((c) => {
      const m = metricas.get(c.id);
      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        direccion: c.direccion,
        correo: c.correo,
        cedula: c.cedula,
        created_at: c.created_at,
        puntos_actuales: c.puntos_actuales ?? 0,
        total_pedidos: m?.n ?? 0,
        total_gastado: m?.gastado ?? 0,
        ultimo_pedido: m?.ultimo ?? null,
        _nombre: plegar(`${c.nombre} ${c.apellido ?? ''}`.trim()),
        _telefono: soloDigitos(c.telefono ?? ''),
        _direccion: plegar(c.direccion ?? ''),
        _correo: plegar(c.correo ?? ''),
        _cedula: plegar(c.cedula ?? ''),
        _creado: Date.parse(c.created_at),
      };
    });
  }

  /** Supabase corta cada consulta en 1.000 filas: se pagina hasta traer todo. */
  private async traerTodo<T>(tabla: string, columnas: string): Promise<T[]> {
    const todas: T[] = [];
    for (let desde = 0; ; desde += LOTE) {
      const { data, error } = await this.supabase
        .getClient()
        .from(tabla)
        .select(columnas)
        .order('id')
        .range(desde, desde + LOTE - 1);
      if (error) throw error;
      const lote = (data ?? []) as T[];
      todas.push(...lote);
      if (lote.length < LOTE) return todas;
    }
  }
}
