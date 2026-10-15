import { sumarDias } from '@/lib/semana';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Subconjunto de PedidoAdmin que necesita el buscador (compatible por estructura). */
export type PedidoBuscable = {
  id: string;
  canal: 'web' | 'pos';
  cliente: {
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    direccion: string | null;
    correo: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  metodo_pago: string;
  estado: string;
  total: number;
  created_at: string;
  items: { producto_nombre: string; variante_nombre: string }[];
};

export type FiltroCanal = 'todos' | 'web' | 'pos';
export type FiltroEstado = 'todos' | 'activos' | 'entregado' | 'cancelado';
export type FiltroTipo = 'todos' | 'domicilio' | 'retiro' | 'local';
export type FiltroPago = 'todos' | 'efectivo' | 'transferencia' | 'tarjeta';
export type FiltroFecha = 'todos' | 'hoy' | 'ayer' | '7d' | '30d';
export type Orden = 'auto' | 'recientes' | 'antiguos' | 'mayor' | 'menor';

export type FiltrosPedidos = {
  texto: string;
  canal: FiltroCanal;
  estado: FiltroEstado;
  tipo: FiltroTipo;
  pago: FiltroPago;
  fecha: FiltroFecha;
  orden: Orden;
};

export const FILTROS_INICIALES: FiltrosPedidos = {
  texto: '',
  canal: 'todos',
  estado: 'todos',
  tipo: 'todos',
  pago: 'todos',
  fecha: 'todos',
  orden: 'auto',
};

export const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Para llevar',
  local: 'Comer en el local',
};

export const CANAL_LABEL: Record<string, string> = { web: 'Web', pos: 'Local' };

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Minúsculas y sin tildes, conservando la longitud 1:1 para poder mapear las
 * posiciones del texto plegado al original (resaltado de coincidencias).
 */
export function plegar(texto: string): string {
  let salida = '';
  for (const c of texto) {
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    salida += base.length === c.length ? base : c.toLowerCase();
  }
  return salida;
}

const ES_ALFANUMERICO = /[\p{L}\p{N}]/u;

/**
 * Coincidencia por inicio de palabra: "ana" encuentra "Ana Pérez" y
 * "ana@correo.co", pero no "Hawaiana" ni "Mediana". Con espacios (frases)
 * exige que la frase arranque en un límite de palabra.
 */
export function coincide(campo: string, v: string): boolean {
  if (!v) return false;
  let i = campo.indexOf(v);
  while (i !== -1) {
    if (i === 0 || !ES_ALFANUMERICO.test(campo[i - 1])) return true;
    i = campo.indexOf(v, i + 1);
  }
  return false;
}

function soloDigitos(texto: string) {
  return texto.replace(/\D/g, '');
}

/** Dígitos de un teléfono tecleado: "+57 315…" se busca sin el indicativo de Colombia. */
function digitosTelefono(texto: string) {
  const sinIndicativo = texto.trim().replace(/^\+\s*57(?=\D*\d)/, '');
  return soloDigitos(sinIndicativo);
}

const FORMATO_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
});
const FORMATO_FECHA_TEXTO = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeZone: 'America/Bogota',
});

/** Día calendario del pedido en hora de Bogotá ('YYYY-MM-DD'). */
export function diaBogota(iso: string): string {
  return FORMATO_YMD.format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Índice por pedido (se calcula una vez por objeto)
// ---------------------------------------------------------------------------

type Indice = {
  cliente: string;
  tel: string;
  dir: string;
  correo: string;
  id: string;
  producto: string;
  pago: string;
  estado: string;
  tipo: string;
  canal: string;
  total: number;
  dia: string;
  fechaTexto: string;
};

const TIPO_SINONIMOS: Record<string, string> = {
  domicilio: 'domicilio envio a domicilio',
  retiro: 'retiro para llevar recoger',
  local: 'local comer en el local mesa',
};
const CANAL_SINONIMOS: Record<string, string> = {
  web: 'web online pagina internet',
  pos: 'local pos mostrador tienda',
};

const CACHE = new WeakMap<object, Indice>();

function indexar(p: PedidoBuscable): Indice {
  const guardado = CACHE.get(p);
  if (guardado) return guardado;
  const indice: Indice = {
    cliente: plegar(`${p.cliente.nombre} ${p.cliente.apellido ?? ''}`.trim()),
    tel: soloDigitos(p.cliente.telefono ?? ''),
    dir: plegar(`${p.direccion_entrega ?? ''} ${p.cliente.direccion ?? ''}`),
    correo: plegar(p.cliente.correo ?? ''),
    id: plegar(p.id),
    producto: plegar(
      p.items
        .map((i) => `${i.producto_nombre} ${i.variante_nombre}`)
        .join(' | '),
    ),
    pago: plegar(p.metodo_pago),
    estado: plegar(`${p.estado} ${p.estado.replace(/_/g, ' ')}`),
    tipo: plegar(
      `${p.modalidad} ${MODALIDAD_LABEL[p.modalidad] ?? ''} ${TIPO_SINONIMOS[p.modalidad] ?? ''}`,
    ),
    canal: plegar(
      `${CANAL_LABEL[p.canal] ?? ''} ${CANAL_SINONIMOS[p.canal] ?? ''}`,
    ),
    total: p.total,
    dia: diaBogota(p.created_at),
    fechaTexto: plegar(FORMATO_FECHA_TEXTO.format(new Date(p.created_at))),
  };
  CACHE.set(p, indice);
  return indice;
}

// ---------------------------------------------------------------------------
// Consulta: palabras libres + operadores (campo:valor, -campo:valor, "frases")
// ---------------------------------------------------------------------------

export type Operador =
  | 'cliente'
  | 'tel'
  | 'dir'
  | 'id'
  | 'producto'
  | 'pago'
  | 'estado'
  | 'tipo'
  | 'canal'
  | 'total'
  | 'fecha'
  | 'correo';

const ALIAS: Record<string, Operador> = {
  cliente: 'cliente',
  nombre: 'cliente',
  tel: 'tel',
  telefono: 'tel',
  celular: 'tel',
  dir: 'dir',
  direccion: 'dir',
  id: 'id',
  pedido: 'id',
  producto: 'producto',
  item: 'producto',
  pago: 'pago',
  metodo: 'pago',
  estado: 'estado',
  tipo: 'tipo',
  modalidad: 'tipo',
  canal: 'canal',
  origen: 'canal',
  total: 'total',
  valor: 'total',
  fecha: 'fecha',
  correo: 'correo',
  email: 'correo',
};

export type Termino = {
  operador: Operador | null;
  valor: string;
  negado: boolean;
  /** Texto original tal como lo escribió la persona (para quitarlo de la consulta). */
  bruto: string;
};

const PATRON_TERMINO = /(-)?(?:([\p{L}]+):)?(?:"([^"]*)"|(\S+))/gu;

export function tokenizar(consulta: string): Termino[] {
  const terminos: Termino[] = [];
  for (const m of consulta.matchAll(PATRON_TERMINO)) {
    const negado = Boolean(m[1]);
    const prefijo = m[2];
    const valor = (m[3] ?? m[4] ?? '').trim();
    const operador = prefijo ? (ALIAS[plegar(prefijo)] ?? null) : null;
    if (operador) {
      if (valor) terminos.push({ operador, valor, negado, bruto: m[0] });
      continue;
    }
    // Prefijo desconocido ("hora:", "4:30"): se trata como texto libre.
    const libre = prefijo ? `${prefijo}:${valor}` : valor;
    // "+57" suelto es solo el indicativo de Colombia: no filtra nada.
    if (libre.trim() && libre.trim() !== '+57') {
      terminos.push({
        operador: null,
        valor: libre,
        negado: false,
        bruto: m[0],
      });
    }
  }
  return terminos;
}

/** Quita un término de la consulta (chip ✕) sin tocar el resto. */
export function quitarTermino(consulta: string, termino: Termino): string {
  const i = consulta.indexOf(termino.bruto);
  if (i < 0) return consulta;
  return `${consulta.slice(0, i)}${consulta.slice(i + termino.bruto.length)}`
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Coincidencia
// ---------------------------------------------------------------------------

function parsearMonto(texto: string): number | null {
  const limpio = texto.trim().toLowerCase().replace(/[$\s]/g, '');
  const m = limpio.match(/^(\d+(?:[.,]\d+)?)(k|mil)?$/);
  if (!m) return null;
  if (m[2]) return Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
  const entero = Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(entero) ? entero : null;
}

function cumpleTotal(total: number, valor: string): boolean {
  const v = valor.trim().toLowerCase().replace(/\s/g, '');
  const cmp = v.match(/^(>=|<=|>|<|=)(.+)$/);
  if (cmp) {
    const n = parsearMonto(cmp[2]);
    if (n === null) return false;
    if (cmp[1] === '>') return total > n;
    if (cmp[1] === '>=') return total >= n;
    if (cmp[1] === '<') return total < n;
    if (cmp[1] === '<=') return total <= n;
    return total === n;
  }
  const rango = v.match(/^(.+?)(?:-|\.\.)(.+)$/);
  if (rango) {
    const a = parsearMonto(rango[1]);
    const b = parsearMonto(rango[2]);
    if (a !== null && b !== null) {
      return total >= Math.min(a, b) && total <= Math.max(a, b);
    }
  }
  const exacto = parsearMonto(v);
  return exacto !== null && total === exacto;
}

function cumpleFecha(dia: string, valor: string, hoy: string): boolean {
  const v = plegar(valor);
  if (v === 'hoy') return dia === hoy;
  if (v === 'ayer') return dia === sumarDias(hoy, -1);
  if (v === '7d' || v === 'semana')
    return dia >= sumarDias(hoy, -6) && dia <= hoy;
  if (v === '30d' || v === 'mes')
    return dia >= sumarDias(hoy, -29) && dia <= hoy;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dia === v;
  return false;
}

function cumpleTermino(ind: Indice, t: Termino, hoy: string): boolean {
  const v = plegar(t.valor.replace(/^#/, ''));
  let ok: boolean;
  switch (t.operador) {
    case 'cliente':
      ok = coincide(ind.cliente, v);
      break;
    case 'tel': {
      const d = digitosTelefono(t.valor);
      ok = d.length > 0 && ind.tel.includes(d);
      break;
    }
    case 'dir':
      ok = coincide(ind.dir, v);
      break;
    case 'correo':
      ok = coincide(ind.correo, v);
      break;
    case 'id':
      ok = ind.id.includes(v) || ind.id.replace(/-/g, '').includes(v);
      break;
    case 'producto':
      ok = coincide(ind.producto, v);
      break;
    case 'pago':
      ok = coincide(ind.pago, v);
      break;
    case 'estado':
      ok =
        v === 'activo' || v === 'activos'
          ? !ind.estado.startsWith('entregado') &&
            !ind.estado.startsWith('cancelado')
          : coincide(ind.estado, v);
      break;
    case 'tipo':
      ok = coincide(ind.tipo, v);
      break;
    case 'canal':
      ok = coincide(ind.canal, v);
      break;
    case 'total':
      ok = cumpleTotal(ind.total, t.valor);
      break;
    case 'fecha':
      ok = cumpleFecha(ind.dia, t.valor, hoy);
      break;
    default: {
      // Texto libre: busca en todos los campos relevantes.
      // El id solo coincide por prefijo (lo que se ve en la tarjeta: #a1b2c3d4);
      // por substring, palabras como "dead" saldrían dentro de cualquier UUID.
      ok =
        coincide(ind.cliente, v) ||
        coincide(ind.dir, v) ||
        coincide(ind.correo, v) ||
        ind.id.startsWith(v) ||
        ind.id.replace(/-/g, '').startsWith(v) ||
        coincide(ind.producto, v) ||
        coincide(ind.pago, v) ||
        coincide(ind.estado, v) ||
        coincide(ind.tipo, v) ||
        coincide(ind.canal, v) ||
        ind.fechaTexto.includes(v);
      if (!ok && /^[+\d][\d\s().-]*$/.test(t.valor)) {
        const d = digitosTelefono(t.valor);
        // Fragmentos de 1-2 dígitos son demasiado ambiguos para buscar en teléfonos.
        ok = d.length >= 3 && ind.tel.includes(d);
        if (!ok && d.length >= 4) ok = cumpleTotal(ind.total, `=${t.valor}`);
      }
    }
  }
  return t.negado ? !ok : ok;
}

/** Puntaje por término libre: qué tan "arriba" cae la coincidencia (nombre > teléfono > producto…). */
function puntaje(ind: Indice, terminos: Termino[]): number {
  let total = 0;
  for (const t of terminos) {
    if (t.negado) continue;
    const v = plegar(t.valor.replace(/^#/, ''));
    const palabrasCliente = ind.cliente.split(' ');
    if (ind.id.startsWith(v)) total += 100;
    else if (ind.cliente.startsWith(v)) total += 90;
    else if (palabrasCliente.some((w) => w.startsWith(v))) total += 80;
    else if (ind.tel.includes(soloDigitos(v) || '\u0000')) total += 70;
    else if (ind.cliente.includes(v)) total += 55;
    else if (coincide(ind.producto, v)) total += 40;
    else total += 20;
  }
  return total;
}

type Facetas = Omit<FiltrosPedidos, 'texto' | 'orden'>;
type GrupoFaceta = keyof Facetas;

function cumpleFaceta(
  p: PedidoBuscable,
  ind: Indice,
  f: Facetas,
  hoy: string,
  omitir?: GrupoFaceta,
): boolean {
  if (omitir !== 'canal' && f.canal !== 'todos' && p.canal !== f.canal)
    return false;
  if (omitir !== 'estado' && f.estado !== 'todos') {
    const cerrado = p.estado === 'entregado' || p.estado === 'cancelado';
    if (f.estado === 'activos' ? cerrado : p.estado !== f.estado) return false;
  }
  if (omitir !== 'tipo' && f.tipo !== 'todos' && p.modalidad !== f.tipo)
    return false;
  if (omitir !== 'pago' && f.pago !== 'todos' && p.metodo_pago !== f.pago)
    return false;
  if (
    omitir !== 'fecha' &&
    f.fecha !== 'todos' &&
    !cumpleFecha(ind.dia, f.fecha, hoy)
  ) {
    return false;
  }
  return true;
}

function ordenar<T extends PedidoBuscable>(
  lista: { p: T; puntos: number }[],
  orden: Orden,
  hayTexto: boolean,
) {
  const porFecha = (a: { p: T }, b: { p: T }) =>
    b.p.created_at.localeCompare(a.p.created_at);
  const efectivo: Orden =
    orden === 'auto' ? (hayTexto ? 'auto' : 'recientes') : orden;
  return [...lista].sort((a, b) => {
    switch (efectivo) {
      case 'antiguos':
        return -porFecha(a, b);
      case 'mayor':
        return b.p.total - a.p.total || porFecha(a, b);
      case 'menor':
        return a.p.total - b.p.total || porFecha(a, b);
      case 'auto':
        return b.puntos - a.puntos || porFecha(a, b);
      default:
        return porFecha(a, b);
    }
  });
}

export type ResultadoBusqueda<T> = {
  resultados: T[];
  terminos: Termino[];
};

export function buscarPedidos<T extends PedidoBuscable>(
  pedidos: T[],
  filtros: FiltrosPedidos,
  hoy: string,
): ResultadoBusqueda<T> {
  const terminos = tokenizar(filtros.texto);
  const coincidentes: { p: T; puntos: number }[] = [];
  for (const p of pedidos) {
    const ind = indexar(p);
    if (!cumpleFaceta(p, ind, filtros, hoy)) continue;
    if (!terminos.every((t) => cumpleTermino(ind, t, hoy))) continue;
    coincidentes.push({ p, puntos: puntaje(ind, terminos) });
  }
  return {
    resultados: ordenar(coincidentes, filtros.orden, terminos.length > 0).map(
      (x) => x.p,
    ),
    terminos,
  };
}

// ---------------------------------------------------------------------------
// Contadores por faceta (cada grupo ignora su propio filtro, como en un e-commerce)
// ---------------------------------------------------------------------------

export type ConteoFacetas = {
  canal: Record<FiltroCanal, number>;
  estado: Record<FiltroEstado, number>;
  tipo: Record<FiltroTipo, number>;
  pago: Record<FiltroPago, number>;
  fecha: Record<FiltroFecha, number>;
};

export function contarFacetas(
  pedidos: PedidoBuscable[],
  filtros: FiltrosPedidos,
  hoy: string,
): ConteoFacetas {
  const terminos = tokenizar(filtros.texto);
  const conteo: ConteoFacetas = {
    canal: { todos: 0, web: 0, pos: 0 },
    estado: { todos: 0, activos: 0, entregado: 0, cancelado: 0 },
    tipo: { todos: 0, domicilio: 0, retiro: 0, local: 0 },
    pago: { todos: 0, efectivo: 0, transferencia: 0, tarjeta: 0 },
    fecha: { todos: 0, hoy: 0, ayer: 0, '7d': 0, '30d': 0 },
  };
  const ayer = sumarDias(hoy, -1);
  const desde7 = sumarDias(hoy, -6);
  const desde30 = sumarDias(hoy, -29);

  for (const p of pedidos) {
    const ind = indexar(p);
    if (!terminos.every((t) => cumpleTermino(ind, t, hoy))) continue;

    if (cumpleFaceta(p, ind, filtros, hoy, 'canal')) {
      conteo.canal.todos++;
      conteo.canal[p.canal]++;
    }
    if (cumpleFaceta(p, ind, filtros, hoy, 'estado')) {
      conteo.estado.todos++;
      if (p.estado === 'entregado') conteo.estado.entregado++;
      else if (p.estado === 'cancelado') conteo.estado.cancelado++;
      else conteo.estado.activos++;
    }
    if (cumpleFaceta(p, ind, filtros, hoy, 'tipo')) {
      conteo.tipo.todos++;
      if (p.modalidad in conteo.tipo) conteo.tipo[p.modalidad as FiltroTipo]++;
    }
    if (cumpleFaceta(p, ind, filtros, hoy, 'pago')) {
      conteo.pago.todos++;
      if (p.metodo_pago in conteo.pago)
        conteo.pago[p.metodo_pago as FiltroPago]++;
    }
    if (cumpleFaceta(p, ind, filtros, hoy, 'fecha')) {
      conteo.fecha.todos++;
      if (ind.dia === hoy) conteo.fecha.hoy++;
      if (ind.dia === ayer) conteo.fecha.ayer++;
      if (ind.dia >= desde7 && ind.dia <= hoy) conteo.fecha['7d']++;
      if (ind.dia >= desde30 && ind.dia <= hoy) conteo.fecha['30d']++;
    }
  }
  return conteo;
}

/** Cantidad de filtros distintos de "todos" (para el contador del botón "Más filtros"). */
export function contarFiltrosActivos(
  f: FiltrosPedidos,
  grupos: GrupoFaceta[],
): number {
  return grupos.filter((g) => f[g] !== 'todos').length;
}

// ---------------------------------------------------------------------------
// Sugerencias mientras se escribe
// ---------------------------------------------------------------------------

export type Sugerencia = {
  tipo: 'cliente' | 'telefono' | 'producto' | 'pedido';
  etiqueta: string;
  detalle: string;
  /** Término que reemplaza la palabra que se está escribiendo. */
  consulta: string;
};

const MAX_POR_GRUPO = 3;

function entreComillas(valor: string) {
  return /\s/.test(valor) ? `"${valor}"` : valor;
}

/** Palabra que se está escribiendo (la última), sin operador ni comillas abiertas. */
export function palabraActual(texto: string): string {
  if (/\s$/.test(texto) || !texto) return '';
  const ultima = texto.split(/\s+/).pop() ?? '';
  return ultima.includes(':') || ultima.startsWith('"')
    ? ''
    : ultima.replace(/^-/, '');
}

export function sugerir(
  pedidos: PedidoBuscable[],
  palabra: string,
): Sugerencia[] {
  const v = plegar(palabra.replace(/^#/, ''));
  if (v.length < 2) return [];

  const clientes = new Map<string, { nombre: string; n: number }>();
  const productos = new Map<string, { nombre: string; n: number }>();
  const telefonos = new Map<
    string,
    { tel: string; nombre: string; n: number }
  >();
  const ids: Sugerencia[] = [];
  const digitos = soloDigitos(v);
  const pareceId = /^[0-9a-f-]{3,}$/.test(v);

  for (const p of pedidos) {
    const ind = indexar(p);
    const nombre = `${p.cliente.nombre} ${p.cliente.apellido ?? ''}`.trim();
    if (nombre && coincide(ind.cliente, v)) {
      const previo = clientes.get(ind.cliente);
      clientes.set(ind.cliente, { nombre, n: (previo?.n ?? 0) + 1 });
    }
    for (const i of p.items) {
      if (coincide(plegar(i.producto_nombre), v)) {
        const clave = plegar(i.producto_nombre);
        const previo = productos.get(clave);
        productos.set(clave, {
          nombre: i.producto_nombre,
          n: (previo?.n ?? 0) + 1,
        });
      }
    }
    if (
      digitos.length >= 3 &&
      ind.tel.includes(digitos) &&
      p.cliente.telefono
    ) {
      const previo = telefonos.get(ind.tel);
      telefonos.set(ind.tel, {
        tel: p.cliente.telefono,
        nombre: nombre || 'Sin nombre',
        n: (previo?.n ?? 0) + 1,
      });
    }
    if (
      pareceId &&
      ids.length < MAX_POR_GRUPO &&
      ind.id.replace(/-/g, '').startsWith(v.replace(/-/g, ''))
    ) {
      ids.push({
        tipo: 'pedido',
        etiqueta: `#${p.id.slice(0, 8)}`,
        detalle: nombre || 'Cliente sin nombre',
        consulta: `id:${p.id.slice(0, 8)}`,
      });
    }
  }

  const porConteo = <X extends { n: number }>(a: X, b: X) => b.n - a.n;
  const sugerencias: Sugerencia[] = [
    ...[...clientes.values()]
      .sort(porConteo)
      .slice(0, MAX_POR_GRUPO)
      .map<Sugerencia>((c) => ({
        tipo: 'cliente',
        etiqueta: c.nombre,
        detalle: `${c.n} pedido${c.n === 1 ? '' : 's'}`,
        consulta: `cliente:${entreComillas(c.nombre)}`,
      })),
    ...[...telefonos.values()]
      .sort(porConteo)
      .slice(0, MAX_POR_GRUPO)
      .map<Sugerencia>((t) => ({
        tipo: 'telefono',
        etiqueta: t.tel,
        detalle: t.nombre,
        consulta: `tel:${soloDigitos(t.tel)}`,
      })),
    ...[...productos.values()]
      .sort(porConteo)
      .slice(0, MAX_POR_GRUPO)
      .map<Sugerencia>((pr) => ({
        tipo: 'producto',
        etiqueta: pr.nombre,
        detalle: `en ${pr.n} pedido${pr.n === 1 ? '' : 's'}`,
        consulta: `producto:${entreComillas(pr.nombre)}`,
      })),
    ...ids,
  ];
  return sugerencias;
}

/** Reemplaza la palabra que se estaba escribiendo por el término elegido. */
export function aplicarSugerencia(texto: string, consulta: string): string {
  const base = texto.replace(/\S*$/, '').trimEnd();
  return `${base ? `${base} ` : ''}${consulta} `;
}

// ---------------------------------------------------------------------------
// Resaltado y coincidencias que la tarjeta no muestra
// ---------------------------------------------------------------------------

/** Términos (plegados) que conviene resaltar en el texto visible de la tarjeta. */
export function terminosParaResaltar(terminos: Termino[]): string[] {
  const resaltables: (Operador | null)[] = [
    null,
    'cliente',
    'tel',
    'id',
    'producto',
    'dir',
    'correo',
  ];
  return terminos
    .filter((t) => !t.negado && resaltables.includes(t.operador))
    .map((t) =>
      t.operador === 'tel'
        ? digitosTelefono(t.valor)
        : plegar(t.valor.replace(/^#/, '')),
    )
    .filter((v) => v.length > 0);
}

export type Segmento = { texto: string; resaltado: boolean };

export function segmentar(texto: string, terminos: string[]): Segmento[] {
  if (!texto || terminos.length === 0) return [{ texto, resaltado: false }];
  const plano = plegar(texto);
  if (plano.length !== texto.length) return [{ texto, resaltado: false }];

  const marcas: [number, number][] = [];
  for (const t of terminos) {
    // Los términos con letras se marcan solo al inicio de palabra (igual que
    // la búsqueda); los numéricos (teléfonos, ids) en cualquier posición.
    const soloPalabra = /\p{L}/u.test(t);
    let desde = 0;
    while (desde <= plano.length - t.length) {
      const i = plano.indexOf(t, desde);
      if (i < 0) break;
      const limpio =
        !soloPalabra || i === 0 || !ES_ALFANUMERICO.test(plano[i - 1]);
      if (limpio) marcas.push([i, i + t.length]);
      desde = i + 1;
    }
  }
  if (marcas.length === 0) return [{ texto, resaltado: false }];

  marcas.sort((a, b) => a[0] - b[0]);
  const unidas: [number, number][] = [];
  for (const m of marcas) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && m[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], m[1]);
    else unidas.push([m[0], m[1]]);
  }

  const segmentos: Segmento[] = [];
  let cursor = 0;
  for (const [a, b] of unidas) {
    if (a > cursor)
      segmentos.push({ texto: texto.slice(cursor, a), resaltado: false });
    segmentos.push({ texto: texto.slice(a, b), resaltado: true });
    cursor = b;
  }
  if (cursor < texto.length)
    segmentos.push({ texto: texto.slice(cursor), resaltado: false });
  return segmentos;
}

export type CoincidenciaOculta = { campo: string; texto: string };

/**
 * Campos donde coincide la búsqueda pero que la tarjeta no muestra
 * (dirección, correo, productos más allá de los 3 visibles), para que la
 * persona entienda por qué apareció ese pedido.
 */
export function coincidenciasOcultas(
  p: PedidoBuscable,
  terminos: Termino[],
  itemsVisibles = 3,
): CoincidenciaOculta[] {
  const claves = terminosParaResaltar(terminos);
  if (claves.length === 0) return [];
  const tocaAlguno = (texto: string) => {
    const plano = plegar(texto);
    return claves.some((c) => coincide(plano, c));
  };
  const salida: CoincidenciaOculta[] = [];
  if (p.direccion_entrega && tocaAlguno(p.direccion_entrega)) {
    salida.push({ campo: 'Dirección de entrega', texto: p.direccion_entrega });
  }
  if (
    p.cliente.direccion &&
    p.cliente.direccion !== p.direccion_entrega &&
    tocaAlguno(p.cliente.direccion)
  ) {
    salida.push({ campo: 'Dirección del cliente', texto: p.cliente.direccion });
  }
  if (p.cliente.correo && tocaAlguno(p.cliente.correo)) {
    salida.push({ campo: 'Correo', texto: p.cliente.correo });
  }
  for (const i of p.items.slice(itemsVisibles)) {
    const nombre = i.variante_nombre
      ? `${i.producto_nombre} (${i.variante_nombre})`
      : i.producto_nombre;
    if (tocaAlguno(nombre)) salida.push({ campo: 'Producto', texto: nombre });
  }
  return salida;
}
