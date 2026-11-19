import { formatPrecio } from '@/lib/formato';

export type Origen = {
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
  ventas: number;
};

export type Campana = {
  campana_id: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversaciones: number;
  costo_por_conversacion: number | null;
  frecuencia: number | null;
  pedidos: number;
  ventas: number;
  clientes_nuevos: number;
  costo_por_pedido: number | null;
  costo_por_cliente_nuevo: number | null;
  roas: number | null;
  utilidad_bruta: number;
  cobertura_costos: number | null;
  retorno_utilidad: number | null;
};

export type General = {
  gasto_total: number;
  ventas_totales: number;
  pedidos_totales: number;
  pedidos_atribuidos: number;
  roas_general: number | null;
  utilidad_bruta: number;
  margen_pct: number | null;
  cobertura_costos: number | null;
  utilidad_tras_anuncios: number | null;
};

export type AnuncioRendimiento = {
  anuncio_id: string;
  nombre: string;
  estado: string | null;
  miniatura_url: string | null;
  titulo: string | null;
  campana: string;
  gasto: number;
  impresiones: number;
  clics_enlace: number;
  ctr: number | null;
  conversaciones: number;
  costo_por_conversacion: number | null;
  frecuencia: number | null;
  pedidos: number;
};

export type Tablero = {
  desde: string;
  origenes: Origen[];
  general: General;
  campanas: Campana[];
  anuncios: AnuncioRendimiento[];
  gasto_hasta: string | null;
};

export type Sincronizacion = { estado: 'sincronizado' | 'apagado'; filas: number };

export type VentanaRecompra = { dias: number; elegibles: number; recompraron: number; pct: number | null };

export type MetricasCohorte = {
  clientes: number;
  pedidos: number;
  valor: number;
  pedidos_por_cliente: number | null;
  recompra: VentanaRecompra[];
  dias_a_segunda: number | null;
};

export type CohorteMes = MetricasCohorte & { mes: string };
export type CohorteCampana = MetricasCohorte & {
  campana_id: string;
  nombre: string;
  gasto: number;
  costo_por_cliente_nuevo: number | null;
  valor_sobre_gasto: number | null;
};

export type Cohortes = {
  desde: string;
  por_mes: CohorteMes[];
  por_campana: CohorteCampana[];
  clientes_nuevos: number;
  clientes_atribuidos: number;
  primera_compra_desde: string | null;
};

export type SegmentoPublico = {
  clave: string;
  nombre: string;
  descripcion: string;
  personas: number;
  audiencia_id: string | null;
  enviadas: number | null;
  sincronizado_en: string | null;
};

export type PanelPublicos = { encendido: boolean; segmentos: SegmentoPublico[] };

export type ResultadoPublicos = {
  estado: 'sincronizado' | 'apagado';
  enviadas: { clave: string; personas: number }[];
  parecido: string;
  errores: string[];
};

export type VistaAnuncios = 'resumen' | 'campanas' | 'anuncios' | 'clientes' | 'publicos';

export const VISTAS_ANUNCIOS: { key: VistaAnuncios; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'campanas', label: 'Campañas' },
  { key: 'anuncios', label: 'Anuncios' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'publicos', label: 'Públicos' },
];

export const RANGOS_ANUNCIOS = [
  { dias: 7, etiqueta: '7 días', corta: '7 d' },
  { dias: 30, etiqueta: '30 días', corta: '30 d' },
  { dias: 90, etiqueta: '90 días', corta: '90 d' },
] as const;

export type DiasRango = (typeof RANGOS_ANUNCIOS)[number]['dias'];

export const GRUPO_PESTANAS = 'anuncios';

export function veces(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('es-CO')}x`;
}

export function pesos(valor: number | null): string {
  return valor === null ? '—' : formatPrecio(valor);
}

export function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('es-CO')}%`;
}

export function nombreOrigen(o: Origen): string {
  if (o.tipo === 'anuncio') return o.titulo ?? `Anuncio ${o.anuncio_id}`;
  if (o.tipo === 'enlace') return `Enlace «${o.ref}»`;
  return o.fuente === 'desconocida' ? 'Sin dato' : o.fuente;
}

/** Pedidos que cuentan: los cancelados no suman. */
export const pedidosValidos = (o: Origen) => Math.max(o.pedidos - o.cancelados, 0);

export function conversionOrigen(o: Origen): string {
  if (o.conversaciones === 0) return '—';
  return `${Math.round((pedidosValidos(o) / o.conversaciones) * 100)}%`;
}

const MS_POR_DIA = 86_400_000;

/** Fecha AAAA-MM-DD en Bogotá de hace `dias` días (el negocio opera en UTC-5). */
export function fechaHaceDias(dias: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(Date.now() - dias * MS_POR_DIA),
  );
}

/** "17 nov" a partir de AAAA-MM-DD, sin que la zona horaria corra el día. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace('.', '');
}
