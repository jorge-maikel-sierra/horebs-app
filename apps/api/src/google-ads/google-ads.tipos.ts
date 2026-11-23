/** Reportes que manda el Google Ads Script; cada uno va a su tabla. */
export const REPORTES_GOOGLE_ADS = [
  'campanas',
  'palabras',
  'terminos',
  'segmentos',
  'conversiones',
  'anuncios',
] as const;
export type ReporteGoogleAds = (typeof REPORTES_GOOGLE_ADS)[number];

export const DIMENSIONES_SEGMENTO = [
  'hora',
  'dispositivo',
  'ciudad_presencia',
  'ciudad_interes',
] as const;
export type DimensionSegmento = (typeof DIMENSIONES_SEGMENTO)[number];

/** Cabecera de cada envío del script (las filas se validan aparte). */
export interface LoteGoogleAds {
  version: number;
  cuenta_id: string;
  zona_horaria: string;
  moneda: string;
  lote_id: string;
  reporte: ReporteGoogleAds;
  parte: number;
  total_partes: number;
  desde: string | null;
  hasta: string | null;
  filas: unknown[];
}

export interface MetricasBaseFila {
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
}

export interface FilaCampanaDia extends MetricasBaseFila {
  fecha: string;
  campana_id: string;
  campana_nombre: string;
  estado: string | null;
  estado_principal: string | null;
  motivos_estado: string[];
  estrategia_puja: string | null;
  estado_puja: string | null;
  presupuesto_diario: number;
  valor_conversiones: number;
  llamadas: number;
  is_busqueda: number | null;
  is_perdida_presupuesto: number | null;
  is_perdida_ranking: number | null;
  is_superior: number | null;
  is_superior_absoluta: number | null;
}

export interface FilaPalabraDia extends MetricasBaseFila {
  fecha: string;
  campana_id: string;
  grupo_id: string;
  criterio_id: string;
  texto: string;
  concordancia: string | null;
  estado: string | null;
  qs: number | null;
  qs_ctr: string | null;
  qs_anuncio: string | null;
  qs_pagina: string | null;
}

export interface FilaTerminoDia extends MetricasBaseFila {
  fecha: string;
  campana_id: string;
  grupo_id: string;
  termino: string;
  estado: string | null;
}

export interface FilaSegmentoDia extends MetricasBaseFila {
  fecha: string;
  campana_id: string;
  dimension: DimensionSegmento;
  clave: string;
}

export interface FilaConversionDia {
  fecha: string;
  campana_id: string;
  accion: string;
  categoria: string | null;
  conversiones: number;
  valor: number;
}

export interface FilaAnuncio {
  grupo_id: string;
  anuncio_id: string;
  campana_id: string;
  tipo: string | null;
  estado: string | null;
  fuerza: string | null;
  aprobacion: string | null;
  urls_finales: string[];
}

export type FilaGoogleAds =
  | FilaCampanaDia
  | FilaPalabraDia
  | FilaTerminoDia
  | FilaSegmentoDia
  | FilaConversionDia
  | FilaAnuncio;

export interface ResultadoLote {
  lote_id: string;
  reporte: ReporteGoogleAds;
  parte: number;
  filas: number;
  estado: 'guardado' | 'repetido' | 'vacio';
}
