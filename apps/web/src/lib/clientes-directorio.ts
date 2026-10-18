import { diaBogota, plegar } from '@/lib/pedidos-busqueda';

export type Segmento =
  'todos' | 'recurrentes' | 'nuevos' | 'sin_pedidos' | 'con_puntos';

export type OrdenClientes =
  'auto' | 'recientes' | 'nombre' | 'pedidos' | 'gasto' | 'puntos' | 'ultimo';

// Espejo de ClienteDirectorioDto / DirectorioClientesDto del API.
export type ClienteDirectorio = {
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
};

export type Directorio = {
  items: ClienteDirectorio[];
  total: number;
  pagina: number;
  por_pagina: number;
  paginas: number;
  resumen: {
    clientes: number;
    con_pedidos: number;
    nuevos_30d: number;
    puntos_total: number;
  };
  conteos: Record<Segmento, number>;
};

export const POR_PAGINA = 24;

export function nombreCompleto(
  c: Pick<ClienteDirectorio, 'nombre' | 'apellido'>,
) {
  return `${c.nombre} ${c.apellido ?? ''}`.trim() || 'Cliente sin nombre';
}

/** Dos letras: nombre + apellido, o las dos primeras palabras del nombre. */
export function iniciales(c: Pick<ClienteDirectorio, 'nombre' | 'apellido'>) {
  const palabras = nombreCompleto(c)
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
  const letra = (p?: string) => (p ? Array.from(p)[0].toUpperCase() : '');
  return letra(palabras[0]) + letra(palabras[1]) || '?';
}

// Tintes de marca con su versión oscura; el mismo cliente siempre tiene el mismo color.
const AVATARES = [
  'bg-brand-orange/15 text-accent-ink',
  'bg-blue-100 text-brand-navy dark:bg-blue-400/15 dark:text-blue-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
];

export function claseAvatar(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARES[h % AVATARES.length];
}

/** Días calendario (Bogotá) entre una fecha ISO y hoy; 0 = hoy. */
export function diasDesde(desdeIso: string, hoy: string) {
  const [a, m, d] = hoy.split('-').map(Number);
  const [a2, m2, d2] = diaBogota(desdeIso).split('-').map(Number);
  return Math.round(
    (Date.UTC(a, m - 1, d) - Date.UTC(a2, m2 - 1, d2)) / 86_400_000,
  );
}

/** "Hoy", "Ayer", "Hace 5 días", "Hace 3 meses"… contando días calendario de Bogotá. */
export function tiempoRelativo(iso: string, hoy: string): string {
  const n = diasDesde(iso, hoy);
  if (n <= 0) return 'Hoy';
  if (n === 1) return 'Ayer';
  if (n < 30) return `Hace ${n} días`;
  if (n < 365) {
    const meses = Math.floor(n / 30);
    return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }
  const anios = Math.floor(n / 365);
  return `Hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
}

const MES_ANIO = new Intl.DateTimeFormat('es-CO', {
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

export function clienteDesde(iso: string): string {
  return MES_ANIO.format(new Date(iso)).replace(/\./g, '');
}

/** Enlace wa.me para teléfonos colombianos (10 dígitos, o 12 con el 57). Null si no sirve. */
export function enlaceWhatsapp(telefono: string | null): string | null {
  const d = (telefono ?? '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) return `https://wa.me/57${d}`;
  if (d.length === 12 && d.startsWith('57')) return `https://wa.me/${d}`;
  return null;
}

/** Palabras de la búsqueda para resaltar (mismo criterio que el servidor: sin tildes, "+57" ignorado). */
export function terminosBusqueda(q: string): string[] {
  return plegar(q)
    .split(/\s+/)
    .filter((t) => t && t !== '+57')
    .map((t) =>
      /^[+\d][\d\s().-]*$/.test(t)
        ? t.replace(/^\+\s*57/, '').replace(/\D/g, '')
        : t,
    )
    .filter(Boolean);
}

// ---- Detalle de un cliente ----

// Espejo de ClienteDetalleDto, MovimientoPuntosDto y PedidoClienteDto del API.
export type ClienteDetalle = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  cedula: string | null;
  created_at?: string;
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
};

export type MovimientoPuntos = {
  id: string;
  tipo: 'ganado' | 'canjeado' | 'vencido' | 'ajuste';
  puntos: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
};

export type PedidoCliente = {
  id: string;
  canal: string;
  modalidad: string;
  metodo_pago: string;
  estado: string;
  total: number;
  costo_domicilio: number;
  created_at: string;
  items: { nombre: string; cantidad: number }[];
};

/** Productos que más pidió (unidades), sin contar pedidos cancelados. */
export function productosFavoritos(
  pedidos: PedidoCliente[],
  max = 3,
): { nombre: string; cantidad: number }[] {
  const suma = new Map<string, number>();
  for (const p of pedidos) {
    if (p.estado === 'cancelado') continue;
    for (const i of p.items)
      suma.set(i.nombre, (suma.get(i.nombre) ?? 0) + i.cantidad);
  }
  return [...suma.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort(
      (a, b) =>
        b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'),
    )
    .slice(0, max);
}

/** Valor más repetido de un campo de los pedidos (método de pago, modalidad…) con su porcentaje. */
export function valorFrecuente(
  pedidos: PedidoCliente[],
  campo: 'metodo_pago' | 'modalidad',
): { valor: string; pct: number } | null {
  const validos = pedidos.filter((p) => p.estado !== 'cancelado');
  if (validos.length === 0) return null;
  const cuenta = new Map<string, number>();
  for (const p of validos)
    cuenta.set(p[campo], (cuenta.get(p[campo]) ?? 0) + 1);
  const [valor, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  return { valor, pct: Math.round((n / validos.length) * 100) };
}
