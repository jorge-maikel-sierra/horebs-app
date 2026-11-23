import { formatPrecio } from '@/lib/formato';

// Espejo del DTO de GET /admin/google-ads (apps/api/src/google-ads).

export type Metricas = {
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  cpa: number | null;
  muestra: { ctr: boolean; cvr: boolean; cpa: boolean };
};

export type Cuota = {
  busqueda: number | null;
  perdida_presupuesto: number | null;
  perdida_ranking: number | null;
  superior: number | null;
  superior_absoluta: number | null;
  acotada_inferior: boolean;
  acotada_superior: boolean;
};

export type ResumenAds = Metricas & {
  valor_conversiones: number;
  llamadas: number;
  roas_ads: number | null;
  cuota: Cuota;
};

export type Negocio = {
  pedidos: number;
  ventas: number;
  gasto_google: number;
  gasto_meta: number;
  roas_combinado: number | null;
  cpa_combinado: number | null;
  clientes_nuevos: number;
  cac_combinado: number | null;
  pedidos_google: number;
  ventas_google: number;
  cpa_google: number | null;
  roas_google: number | null;
  cobertura: number | null;
  cota_inferior: boolean;
};

export type Ritmo = {
  mes: string;
  gasto_mes: number;
  presupuesto_diario: number;
  presupuesto_mes: number;
  dias_transcurridos: number;
  dias_mes: number;
  proyeccion: number | null;
  ritmo: number | null;
};

export type PuntoSerie = { fecha: string; gasto: number; impresiones: number; clics: number; conversiones: number };

export type AccionConversion = {
  accion: string;
  categoria: string | null;
  conversiones: number;
  valor: number;
  conversiones_anterior: number;
};

export type CampanaAds = Metricas & {
  campana_id: string;
  nombre: string;
  estado: string | null;
  estado_principal: string | null;
  motivos_estado: string[];
  estrategia_puja: string | null;
  estado_puja: string | null;
  presupuesto_diario: number;
  cuota: Cuota;
};

export type Palabra = Metricas & {
  clave: string;
  texto: string;
  concordancia: string | null;
  estado: string | null;
  qs: number | null;
  qs_ctr: string | null;
  qs_anuncio: string | null;
  qs_pagina: string | null;
};

export type Termino = Metricas & {
  termino: string;
  estado: string | null;
  marca: boolean;
  candidata_negativa: boolean;
};

export type Terminos = {
  lista: Termino[];
  resto: Metricas & { terminos: number };
  marca: Metricas;
  generico: Metricas;
  candidatas_negativas: string[];
  gasto_sin_termino: number | null;
};

export type CeldaHora = { dia: number; hora: number; gasto: number; clics: number; conversiones: number };
export type Segmento = Metricas & { clave: string };
export type Ciudad = { nombre: string; tipo: 'presencia' | 'interes'; gasto: number; clics: number; conversiones: number };

export type AnuncioAds = {
  grupo_id: string;
  anuncio_id: string;
  campana_id: string;
  tipo: string | null;
  estado: string | null;
  fuerza: string | null;
  aprobacion: string | null;
  urls_finales: string[];
};

export type Alerta = {
  codigo: string;
  severidad: 'critica' | 'alta' | 'media' | 'baja';
  titulo: string;
  detalle: string;
  accion: string;
};

export type TableroAds = {
  desde: string;
  hasta: string;
  anterior: { desde: string; hasta: string };
  sincronizacion: { ultimo_envio: string | null; datos_hasta: string | null };
  muestra_minima: { impresiones_ctr: number; clics_cvr: number; conversiones_cpa: number };
  resumen: ResumenAds;
  resumen_anterior: ResumenAds;
  serie: PuntoSerie[];
  conversiones: AccionConversion[];
  negocio: Negocio;
  negocio_anterior: Negocio;
  ritmo: Ritmo;
  campanas: CampanaAds[];
  palabras: Palabra[];
  terminos: Terminos;
  horas: CeldaHora[];
  agotamiento: { fecha: string; hora: number }[];
  dispositivos: Segmento[];
  geo: { ciudades: Ciudad[]; fuera_zona: number | null; por_interes: number | null };
  anuncios: AnuncioAds[];
  alertas: Alerta[];
};

export type VistaAds = 'resumen' | 'palabras' | 'terminos' | 'segmentos';

export const VISTAS_ADS: { key: VistaAds; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'palabras', label: 'Palabras y anuncios' },
  { key: 'terminos', label: 'Búsquedas' },
  { key: 'segmentos', label: 'Hora y zona' },
];

export const RANGOS_ADS = [
  { dias: 7, etiqueta: '7 días' },
  { dias: 14, etiqueta: '14 días' },
  { dias: 28, etiqueta: '28 días' },
  { dias: 90, etiqueta: '90 días' },
] as const;

export type DiasAds = (typeof RANGOS_ADS)[number]['dias'];

export const GRUPO_PESTANAS_ADS = 'google-ads';

const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function pesos(v: number | null): string {
  return v === null ? '—' : formatPrecio(v);
}

/** Fracción (0..1) → "12,5%". */
export function pct(v: number | null): string {
  return v === null ? '—' : `${PCT.format(v * 100)}%`;
}

export function numero(v: number | null): string {
  return v === null ? '—' : NUM.format(v);
}

export function veces(v: number | null): string {
  return v === null ? '—' : `${NUM.format(v)}x`;
}

const ZONA = 'America/Bogota';

/** Fecha AAAA-MM-DD de Bogotá desplazada `dias` (negativo = antes). */
export function diaBogota(dias = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
  const t = Date.parse(`${hoy}T00:00:00Z`) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function fechaCorta(ymd: string): string {
  return FECHA_CORTA.format(new Date(`${ymd}T00:00:00Z`)).replace(/\./g, '');
}

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONA,
});

export function fechaHora(iso: string): string {
  return FECHA_HORA.format(new Date(iso)).replace(/\./g, '');
}

const HORAS_VIEJO = 36;
const HORAS_MUY_VIEJO = 72;

export type EstadoSync = 'al_dia' | 'viejo' | 'muy_viejo' | 'sin_datos';

export function estadoSincronizacion(ultimo: string | null): EstadoSync {
  if (!ultimo) return 'sin_datos';
  const horas = (Date.now() - Date.parse(ultimo)) / 3_600_000;
  if (horas > HORAS_MUY_VIEJO) return 'muy_viejo';
  return horas > HORAS_VIEJO ? 'viejo' : 'al_dia';
}

/** Nombres legibles de los enums de Google. */
const ETIQUETAS: Record<string, string> = {
  ENABLED: 'Activa',
  PAUSED: 'Pausada',
  ELIGIBLE: 'Apta',
  LIMITED: 'Limitada',
  LEARNING: 'Aprendiendo',
  NOT_ELIGIBLE: 'No apta',
  MISCONFIGURED: 'Mal configurada',
  PENDING: 'Pendiente',
  ENDED: 'Terminada',
  EXACT: 'Exacta',
  PHRASE: 'Frase',
  BROAD: 'Amplia',
  ABOVE_AVERAGE: 'Por encima',
  AVERAGE: 'Promedio',
  BELOW_AVERAGE: 'Por debajo',
  EXCELLENT: 'Excelente',
  GOOD: 'Buena',
  POOR: 'Pobre',
  APPROVED: 'Aprobado',
  APPROVED_LIMITED: 'Aprobado (limitado)',
  DISAPPROVED: 'Rechazado',
  AREA_OF_INTEREST_ONLY: 'Solo área de interés',
  MOBILE: 'Celular',
  DESKTOP: 'Computador',
  TABLET: 'Tableta',
  CONNECTED_TV: 'TV',
  OTHER: 'Otro',
  MAXIMIZE_CLICKS: 'Maximizar clics',
  MAXIMIZE_CONVERSIONS: 'Maximizar conversiones',
  MAXIMIZE_CONVERSION_VALUE: 'Maximizar valor',
  TARGET_CPA: 'CPA objetivo',
  TARGET_ROAS: 'ROAS objetivo',
  MANUAL_CPC: 'CPC manual',
  TARGET_IMPRESSION_SHARE: 'Cuota objetivo',
  ADDED: 'Agregado',
  EXCLUDED: 'Excluido',
  NONE: '—',
};

export function etiqueta(v: string | null): string {
  if (!v) return '—';
  return new Map(Object.entries(ETIQUETAS)).get(v) ?? v.replace(/_/g, ' ').toLowerCase();
}
