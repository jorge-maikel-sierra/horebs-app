import type {
  ClienteDirectorioDto,
  Coincidencia,
  ConsultaDirectorio,
  DirectorioClientesDto,
  FilaClienteDirectorio,
  FilaDirectorio,
  FilaPedidoDirectorio,
  MetricasCliente,
  OrdenCliente,
  ResumenDirectorio,
  SegmentoCliente,
} from './clientes-directorio.tipos';

const DIAS_NUEVO = 30;
const MS_POR_DIA = 86_400_000;
const POR_PAGINA_DEFECTO = 24;
const POR_PAGINA_MAX = 60;
const MAX_TERMINOS = 6;
const PEDIDOS_RECURRENTE = 2;
const DIGITOS_MINIMOS_BUSQUEDA = 3;

// Cuánto pesa cada coincidencia al ordenar por relevancia (nombre > teléfono > resto).
const PUNTAJE_NOMBRE_INICIO = 100;
const PUNTAJE_NOMBRE_PALABRA = 80;
const PUNTAJE_TELEFONO = 70;
const PUNTAJE_CEDULA = 60;
const PUNTAJE_CONTACTO = 20;

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

const ES_ALFANUMERICO = /[\p{L}\p{N}]/u;
const ES_TELEFONICO = /^[+\d][\d\s().-]*$/;
const SIN_PEDIDOS: MetricasCliente = { n: 0, gastado: 0, ultimo: null };

/** Minúsculas y sin tildes: "José" y "jose" son lo mismo al buscar. */
export function plegar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Coincidencia por inicio de palabra: "ana" encuentra "Ana Pérez" pero no "Mediana". */
export function coincide(campo: string, v: string): boolean {
  if (!v) return false;
  let i = campo.indexOf(v);
  while (i !== -1) {
    if (i === 0 || !ES_ALFANUMERICO.test(campo[i - 1])) return true;
    i = campo.indexOf(v, i + 1);
  }
  return false;
}

export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Dígitos de un teléfono tecleado, sin el indicativo +57 de Colombia. */
export function digitosTelefono(texto: string): string {
  return soloDigitos(texto.trim().replace(/^\+\s*57(?=\D*\d)/, ''));
}

export function entero(valor: unknown, defecto: number): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : defecto;
}

export function terminosDeBusqueda(q: string | undefined): string[] {
  return (
    plegar(q ?? '')
      .split(/\s+/)
      // "+57" suelto es solo el indicativo de Colombia: no filtra nada.
      .filter((t) => t && t !== '+57')
      .slice(0, MAX_TERMINOS)
  );
}

/** 0 = no coincide; más alto = mejor coincidencia. */
export function puntajeTermino(f: FilaDirectorio, t: string): number {
  const numerico = ES_TELEFONICO.test(t) ? puntajeNumerico(f, t) : 0;
  if (numerico > 0) return numerico;
  if (f._nombre.startsWith(t)) return PUNTAJE_NOMBRE_INICIO;
  if (coincide(f._nombre, t)) return PUNTAJE_NOMBRE_PALABRA;
  if (coincide(f._direccion, t) || coincide(f._correo, t)) {
    return PUNTAJE_CONTACTO;
  }
  return 0;
}

function puntajeNumerico(f: FilaDirectorio, t: string): number {
  const d = digitosTelefono(t);
  if (d.length < DIGITOS_MINIMOS_BUSQUEDA) return 0;
  if (f._telefono.includes(d)) return PUNTAJE_TELEFONO;
  return f._cedula.includes(d) ? PUNTAJE_CEDULA : 0;
}

/** Clientes que cumplen TODOS los términos, con la suma de sus puntajes. */
export function coincidencias(
  filas: FilaDirectorio[],
  terminos: string[],
): Coincidencia[] {
  const resultado: Coincidencia[] = [];
  for (const fila of filas) {
    const puntajes = terminos.map((t) => puntajeTermino(fila, t));
    if (puntajes.every((p) => p > 0)) {
      resultado.push({ fila, puntos: puntajes.reduce((s, p) => s + p, 0) });
    }
  }
  return resultado;
}

export function cumpleSegmento(
  f: FilaDirectorio,
  segmento: SegmentoCliente,
  corteNuevos: number,
): boolean {
  switch (segmento) {
    case 'recurrentes':
      return f.total_pedidos >= PEDIDOS_RECURRENTE;
    case 'nuevos':
      return f._creado >= corteNuevos;
    case 'sin_pedidos':
      return f.total_pedidos === 0;
    case 'con_puntos':
      return f.puntos_actuales > 0;
    default:
      return true;
  }
}

export function contarSegmentos(
  lista: Coincidencia[],
  corteNuevos: number,
): Record<SegmentoCliente, number> {
  return Object.fromEntries(
    SEGMENTOS.map((s) => [
      s,
      lista.filter(({ fila }) => cumpleSegmento(fila, s, corteNuevos)).length,
    ]),
  ) as Record<SegmentoCliente, number>;
}

type Comparador = (x: Coincidencia, y: Coincidencia) => number;

const porReciente = (a: FilaDirectorio, b: FilaDirectorio): number =>
  b._creado - a._creado;

/** Quien nunca pidió va al final. */
const ultimoPedidoMs = (f: FilaDirectorio): number =>
  f.ultimo_pedido ? Date.parse(f.ultimo_pedido) : -1;

const COMPARADORES = new Map<OrdenCliente, Comparador>([
  [
    'nombre',
    (x, y) =>
      x.fila._nombre.localeCompare(y.fila._nombre, 'es') ||
      porReciente(x.fila, y.fila),
  ],
  [
    'pedidos',
    (x, y) =>
      y.fila.total_pedidos - x.fila.total_pedidos ||
      porReciente(x.fila, y.fila),
  ],
  [
    'gasto',
    (x, y) =>
      y.fila.total_gastado - x.fila.total_gastado ||
      porReciente(x.fila, y.fila),
  ],
  [
    'puntos',
    (x, y) =>
      y.fila.puntos_actuales - x.fila.puntos_actuales ||
      porReciente(x.fila, y.fila),
  ],
  [
    'ultimo',
    (x, y) =>
      ultimoPedidoMs(y.fila) - ultimoPedidoMs(x.fila) ||
      porReciente(x.fila, y.fila),
  ],
  ['auto', (x, y) => y.puntos - x.puntos || porReciente(x.fila, y.fila)],
]);

/** Ordena en sitio. `auto` es por relevancia si hay texto y por reciente si no. */
export function ordenar(
  lista: Coincidencia[],
  orden: OrdenCliente,
  hayTexto: boolean,
): void {
  const efectivo: OrdenCliente =
    orden === 'auto' && !hayTexto ? 'recientes' : orden;
  const comparador: Comparador =
    COMPARADORES.get(efectivo) ?? ((x, y) => porReciente(x.fila, y.fila));
  lista.sort(comparador);
}

export function paginar(
  total: number,
  porPagina: number,
  pedida: unknown,
): { pagina: number; paginas: number; desde: number } {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(paginas, Math.max(1, entero(pedida, 1)));
  return { pagina, paginas, desde: (pagina - 1) * porPagina };
}

export function resumenDeFilas(
  filas: FilaDirectorio[],
  corteNuevos: number,
): ResumenDirectorio {
  return {
    clientes: filas.length,
    con_pedidos: filas.filter((f) => f.total_pedidos > 0).length,
    nuevos_30d: filas.filter((f) => f._creado >= corteNuevos).length,
    puntos_total: filas.reduce((s, f) => s + f.puntos_actuales, 0),
  };
}

export function publica(f: FilaDirectorio): ClienteDirectorioDto {
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

/**
 * Responde una consulta del directorio sobre las filas ya cargadas. Un
 * segmento u orden desconocido cae al valor por defecto, no es un error.
 */
export function armarDirectorio(
  filas: FilaDirectorio[],
  consulta: ConsultaDirectorio,
  ahora: number,
): DirectorioClientesDto {
  const segmento = SEGMENTOS.find((s) => s === consulta.segmento) ?? 'todos';
  const orden = ORDENES.find((o) => o === consulta.orden) ?? 'auto';
  const porPagina = Math.min(
    POR_PAGINA_MAX,
    Math.max(1, entero(consulta.por_pagina, POR_PAGINA_DEFECTO)),
  );
  const terminos = terminosDeBusqueda(consulta.q);
  const corteNuevos = ahora - DIAS_NUEVO * MS_POR_DIA;

  const coincidentes = coincidencias(filas, terminos);
  const filtrados = coincidentes.filter(({ fila }) =>
    cumpleSegmento(fila, segmento, corteNuevos),
  );
  ordenar(filtrados, orden, terminos.length > 0);

  const { pagina, paginas, desde } = paginar(
    filtrados.length,
    porPagina,
    consulta.pagina,
  );
  return {
    items: filtrados
      .slice(desde, desde + porPagina)
      .map(({ fila }) => publica(fila)),
    total: filtrados.length,
    pagina,
    por_pagina: porPagina,
    paginas,
    resumen: resumenDeFilas(filas, corteNuevos),
    conteos: contarSegmentos(coincidentes, corteNuevos),
  };
}

/** Mismo criterio que ClientesService.obtenerDetalle: todos los pedidos del cliente. */
export function metricasDePedidos(
  pedidos: FilaPedidoDirectorio[],
): Map<string, MetricasCliente> {
  const metricas = new Map<string, MetricasCliente>();
  for (const p of pedidos) {
    if (!p.cliente_id) continue;
    const m = metricas.get(p.cliente_id) ?? { ...SIN_PEDIDOS };
    m.n += 1;
    m.gastado += p.total;
    if (!m.ultimo || p.created_at > m.ultimo) m.ultimo = p.created_at;
    metricas.set(p.cliente_id, m);
  }
  return metricas;
}

function camposDeBusqueda(
  c: FilaClienteDirectorio,
): Pick<
  FilaDirectorio,
  '_nombre' | '_telefono' | '_direccion' | '_correo' | '_cedula' | '_creado'
> {
  return {
    _nombre: plegar(`${c.nombre} ${c.apellido ?? ''}`.trim()),
    _telefono: soloDigitos(c.telefono ?? ''),
    _direccion: plegar(c.direccion ?? ''),
    _correo: plegar(c.correo ?? ''),
    _cedula: plegar(c.cedula ?? ''),
    _creado: Date.parse(c.created_at),
  };
}

export function filaDeCliente(
  c: FilaClienteDirectorio,
  m: MetricasCliente,
): FilaDirectorio {
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
    total_pedidos: m.n,
    total_gastado: m.gastado,
    ultimo_pedido: m.ultimo,
    ...camposDeBusqueda(c),
  };
}

export function filasDeDirectorio(
  clientes: FilaClienteDirectorio[],
  pedidos: FilaPedidoDirectorio[],
): FilaDirectorio[] {
  const metricas = metricasDePedidos(pedidos);
  return clientes.map((c) =>
    filaDeCliente(c, metricas.get(c.id) ?? SIN_PEDIDOS),
  );
}
