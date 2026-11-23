import type { ErrorDeCampo } from '../common/problem-details.filter';
import {
  enumerado,
  fecha,
  lista,
  numero,
  opcional,
  texto,
  uuid,
  validarObjeto,
  type Esquema,
} from '../common/validacion';
import {
  DIMENSIONES_SEGMENTO,
  REPORTES_GOOGLE_ADS,
  type FilaGoogleAds,
  type LoteGoogleAds,
  type ReporteGoogleAds,
} from './google-ads.tipos';

export const VERSION_SCRIPT = 1;
export const MAX_FILAS_LOTE = 2000;
const MAX_PARTES = 500;
const MICROS_POR_PESO = 1_000_000;
const MAX_ERRORES_REPORTADOS = 5;
const FORMATO_ID = /^\d{1,20}$/;

export const ESQUEMA_LOTE_GOOGLE_ADS: Esquema = {
  version: numero({ min: VERSION_SCRIPT, max: VERSION_SCRIPT, entero: true }),
  cuenta_id: texto({ max: 20 }),
  zona_horaria: texto({ max: 60 }),
  moneda: texto({ max: 3 }),
  lote_id: uuid(),
  reporte: enumerado(REPORTES_GOOGLE_ADS),
  parte: numero({ min: 1, max: MAX_PARTES, entero: true }),
  total_partes: numero({ min: 1, max: MAX_PARTES, entero: true }),
  desde: opcional(fecha()),
  hasta: opcional(fecha()),
  filas: lista(),
};

/**
 * Tipo de cada campo que manda el script. `micros` llega en millonésimas de
 * peso (como lo da Google) y se guarda en pesos; los int64 de Google llegan
 * como string, por eso los números se aceptan también como texto numérico.
 */
type TipoCampo =
  | 'fecha'
  | 'id'
  | 'texto'
  | 'texto?'
  | 'entero'
  | 'entero?'
  | 'decimal'
  | 'micros'
  | 'fraccion?'
  | 'textos'
  | 'dimension';

type CamposReporte = Record<string, TipoCampo>;

const METRICAS: CamposReporte = {
  gasto: 'micros',
  impresiones: 'entero',
  clics: 'entero',
  conversiones: 'decimal',
};

const CAMPOS_POR_REPORTE: Record<ReporteGoogleAds, CamposReporte> = {
  campanas: {
    fecha: 'fecha',
    campana_id: 'id',
    campana_nombre: 'texto',
    estado: 'texto?',
    estado_principal: 'texto?',
    motivos_estado: 'textos',
    estrategia_puja: 'texto?',
    estado_puja: 'texto?',
    presupuesto_diario: 'micros',
    ...METRICAS,
    valor_conversiones: 'decimal',
    llamadas: 'entero',
    is_busqueda: 'fraccion?',
    is_perdida_presupuesto: 'fraccion?',
    is_perdida_ranking: 'fraccion?',
    is_superior: 'fraccion?',
    is_superior_absoluta: 'fraccion?',
  },
  palabras: {
    fecha: 'fecha',
    campana_id: 'id',
    grupo_id: 'id',
    criterio_id: 'id',
    texto: 'texto',
    concordancia: 'texto?',
    estado: 'texto?',
    qs: 'entero?',
    qs_ctr: 'texto?',
    qs_anuncio: 'texto?',
    qs_pagina: 'texto?',
    ...METRICAS,
  },
  terminos: {
    fecha: 'fecha',
    campana_id: 'id',
    grupo_id: 'id',
    termino: 'texto',
    estado: 'texto?',
    ...METRICAS,
  },
  segmentos: {
    fecha: 'fecha',
    campana_id: 'id',
    dimension: 'dimension',
    clave: 'texto',
    ...METRICAS,
  },
  conversiones: {
    fecha: 'fecha',
    campana_id: 'id',
    accion: 'texto',
    categoria: 'texto?',
    conversiones: 'decimal',
    valor: 'decimal',
  },
  anuncios: {
    grupo_id: 'id',
    anuncio_id: 'id',
    campana_id: 'id',
    tipo: 'texto?',
    estado: 'texto?',
    fuerza: 'texto?',
    aprobacion: 'texto?',
    urls_finales: 'textos',
  },
};

/** Número finito desde number o texto numérico ("12345"); si no, null. */
export function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const REGLAS = new Map<TipoCampo, (v: unknown) => string | null>(
  Object.entries({
    fecha: fecha(),
    id: (v) =>
      typeof v === 'string' && FORMATO_ID.test(v)
        ? null
        : 'debe ser un id numérico',
    texto: texto(),
    'texto?': opcional(texto({ min: 0 })),
    entero: (v) =>
      Number.isInteger(aNumero(v)) && (aNumero(v) ?? -1) >= 0
        ? null
        : 'debe ser un entero',
    'entero?': (v) =>
      v === null || v === undefined || Number.isInteger(aNumero(v))
        ? null
        : 'debe ser un entero',
    decimal: (v) =>
      (aNumero(v) ?? -1) >= 0 ? null : 'debe ser un número no negativo',
    micros: (v) =>
      (aNumero(v) ?? -1) >= 0 ? null : 'debe ser un monto en micros',
    'fraccion?': (v) => {
      if (v === null || v === undefined) return null;
      const n = aNumero(v);
      return n !== null && n >= 0 && n <= 1 ? null : 'debe estar entre 0 y 1';
    },
    textos: (v) =>
      Array.isArray(v) && v.every((x) => typeof x === 'string')
        ? null
        : 'debe ser una lista de textos',
    dimension: enumerado(DIMENSIONES_SEGMENTO),
  }) as [TipoCampo, (v: unknown) => string | null][],
);

const opcionalNumero = (v: unknown): number | null =>
  v === null || v === undefined ? null : aNumero(v);

const CONVERTIDORES = new Map<TipoCampo, (v: unknown) => unknown>([
  ['entero', aNumero],
  ['decimal', aNumero],
  ['micros', (v) => (aNumero(v) ?? 0) / MICROS_POR_PESO],
  ['entero?', opcionalNumero],
  ['fraccion?', opcionalNumero],
  ['texto?', (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)],
  ['texto', (v) => (v as string).trim()],
]);

function convertir(tipo: TipoCampo, valor: unknown): unknown {
  const convertidor = CONVERTIDORES.get(tipo);
  return convertidor ? convertidor(valor) : valor;
}

function esquemaDe(campos: CamposReporte): Esquema {
  return Object.fromEntries(
    Object.entries(campos).map(([campo, tipo]) => [
      campo,
      REGLAS.get(tipo) ?? (() => 'tipo desconocido'),
    ]),
  );
}

export interface ResultadoFilas {
  filas: FilaGoogleAds[];
  errores: ErrorDeCampo[];
}

/** Valida y convierte las filas de un reporte; un campo desconocido es error. */
export function normalizarFilas(
  reporte: ReporteGoogleAds,
  entrada: unknown[],
): ResultadoFilas {
  const campos = new Map(Object.entries(CAMPOS_POR_REPORTE)).get(reporte) ?? {};
  const esquema = esquemaDe(campos);
  const errores: ErrorDeCampo[] = [];
  const filas: FilaGoogleAds[] = [];
  entrada.forEach((cruda, i) => {
    const problemas = validarObjeto(esquema, cruda);
    if (problemas.length > 0) {
      errores.push(
        ...problemas.map((p) => ({
          campo: `filas[${i}].${p.campo ?? ''}`,
          mensaje: `Fila ${i}: ${p.mensaje}`,
        })),
      );
      return;
    }
    const valores = new Map(Object.entries(cruda as object));
    filas.push(
      Object.fromEntries(
        Object.entries(campos).map(([campo, tipo]) => [
          campo,
          convertir(tipo, valores.get(campo)),
        ]),
      ) as unknown as FilaGoogleAds,
    );
  });
  return { filas, errores: errores.slice(0, MAX_ERRORES_REPORTADOS) };
}

/** "588-389-5578" y "5883895578" son la misma cuenta. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export type MotivoRechazo =
  'cuenta' | 'zona_horaria' | 'moneda' | 'rango' | 'partes' | 'filas';

/** Chequeos de la cabecera que dependen de la configuración del negocio. */
export function motivoRechazoLote(
  lote: LoteGoogleAds,
  cuentaEsperada: string,
): MotivoRechazo | null {
  if (soloDigitos(lote.cuenta_id) !== soloDigitos(cuentaEsperada)) {
    return 'cuenta';
  }
  if (lote.zona_horaria !== 'America/Bogota') return 'zona_horaria';
  if (lote.moneda !== 'COP') return 'moneda';
  if (lote.parte > lote.total_partes) return 'partes';
  if (lote.filas.length > MAX_FILAS_LOTE) return 'filas';
  const conFechas = lote.reporte !== 'anuncios';
  if (conFechas && (!lote.desde || !lote.hasta || lote.desde > lote.hasta)) {
    return 'rango';
  }
  return null;
}
