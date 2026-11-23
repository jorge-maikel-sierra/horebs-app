import { CIERRE, HORA_INICIO_PEDIDOS_BOT } from '../common/horario';
import {
  DIAS_POR_SEMANA,
  HORAS_POR_DIA,
  MINUTOS_POR_HORA,
} from '../common/tiempo';
import type { AlertaDto } from './google-ads-alertas';
import {
  cuotaImpresiones,
  dividir,
  sumar,
  sumarDias,
} from './google-ads-metricas';
import type {
  FilaCampanaDia,
  FilaConversionDia,
  FilaSegmentoDia,
  MetricasBaseFila,
} from './google-ads.tipos';

/** Alertas de rendimiento (puras). Umbrales con nombre para ajustarlos. */

export const CLICS_SIN_CONVERSION = 20;
export const IS_PERDIDA_PRESUPUESTO_MAX = 0.2;
export const DIAS_AGOTADO_MAX = 3;
export const HORA_LIMITE_AGOTADO = 21;
export const FRACCION_PRESUPUESTO_AGOTADO = 0.95;
export const FUERA_ZONA_MAX = 0.05;
export const FUERA_HORARIO_MAX = 0.1;
export const DIAS_RECIENTES_CPA = 3;
export const CONVERSIONES_BASE_CPA = 5;
export const FACTOR_CPA_ALTO = 2;
export const IMPRESIONES_CTR_RECIENTE = 500;
export const FACTOR_CTR_CAE = 0.7;
export const QS_BAJO = 4;
export const IMPRESIONES_QS = 100;
export const CLICS_ETIQUETA_ROTA = 30;
export const CIUDAD_NEGOCIO = 'Riohacha';
/** Filas de ubicación sin ciudad: no se sabe si fueron fuera de zona. */
export const SIN_CIUDAD = 'Sin ciudad';
const MAX_NOMBRES = 5;

export interface PuntoSerieAds extends MetricasBaseFila {
  fecha: string;
}

export interface ElementoRendimiento extends MetricasBaseFila {
  nombre: string;
  qs?: number | null;
}

export interface EntradaRendimiento {
  hasta: string;
  campanas: FilaCampanaDia[];
  serie: PuntoSerieAds[];
  palabras: ElementoRendimiento[];
  terminos: ElementoRendimiento[];
  segmentos: FilaSegmentoDia[];
  conversiones: FilaConversionDia[];
}

const HORA_CIERRE = CIERRE / MINUTOS_POR_HORA;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function nombres(lista: ElementoRendimiento[]): string {
  return lista
    .slice(0, MAX_NOMBRES)
    .map((e) => `«${e.nombre}» (${e.clics} clics)`)
    .join(', ');
}

function diasConDatos(filas: { fecha: string }[]): number {
  return new Set(filas.map((f) => f.fecha)).size;
}

export function alertaGastoSinConversion(
  e: EntradaRendimiento,
): AlertaDto | null {
  const sinConversion = [...e.palabras, ...e.terminos]
    .filter((x) => x.clics >= CLICS_SIN_CONVERSION && x.conversiones === 0)
    .sort((a, b) => b.gasto - a.gasto);
  if (sinConversion.length === 0) return null;
  return {
    codigo: 'GASTO_SIN_CONVERSION',
    severidad: 'media',
    titulo: 'Gasto sin conversiones',
    detalle: `${nombres(sinConversion)} sin ninguna conversión.`,
    accion:
      'Agregar como negativa el término que no es de intención de compra, o bajar la puja de la palabra.',
  };
}

/** Por cada día, la hora en que el gasto acumulado alcanzó el 95% del presupuesto. */
export function horasDeAgotamiento(
  segmentos: FilaSegmentoDia[],
  campanas: FilaCampanaDia[],
): Map<string, number> {
  const presupuesto = new Map<string, number>();
  for (const c of campanas) {
    const k = c.fecha;
    presupuesto.set(
      k,
      (presupuesto.get(k) ?? 0) + Number(c.presupuesto_diario),
    );
  }
  const porDia = new Map<string, number[]>();
  for (const s of segmentos.filter((x) => x.dimension === 'hora')) {
    const horas =
      porDia.get(s.fecha) ?? new Array<number>(HORAS_POR_DIA).fill(0);
    horas.splice(
      Number(s.clave),
      1,
      (horas.at(Number(s.clave)) ?? 0) + Number(s.gasto),
    );
    porDia.set(s.fecha, horas);
  }
  const agotado = new Map<string, number>();
  for (const [fecha, horas] of porDia) {
    const tope = (presupuesto.get(fecha) ?? 0) * FRACCION_PRESUPUESTO_AGOTADO;
    let acumulado = 0;
    const hora = horas.findIndex((g) => (acumulado += g) >= tope && tope > 0);
    if (hora >= 0) agotado.set(fecha, hora);
  }
  return agotado;
}

export function alertaPresupuesto(e: EntradaRendimiento): AlertaDto | null {
  const desde = sumarDias(e.hasta, 1 - DIAS_POR_SEMANA);
  const recientes = e.campanas.filter((c) => c.fecha >= desde);
  if (diasConDatos(recientes) < DIAS_POR_SEMANA) return null;
  const perdida = cuotaImpresiones(recientes).perdida_presupuesto;
  const temprano = [
    ...horasDeAgotamiento(e.segmentos, recientes).values(),
  ].filter((h) => h < HORA_LIMITE_AGOTADO).length;
  const porCuota = perdida !== null && perdida > IS_PERDIDA_PRESUPUESTO_MAX;
  if (!porCuota && temprano < DIAS_AGOTADO_MAX) return null;
  const partes = [
    porCuota
      ? `Se perdió ${pct(perdida)} de las impresiones por presupuesto`
      : null,
    temprano >= DIAS_AGOTADO_MAX
      ? `el presupuesto se agotó antes de las 9 p.m. en ${temprano} de 7 días`
      : null,
  ].filter(Boolean);
  return {
    codigo: 'PRESUPUESTO_LIMITA',
    severidad: 'media',
    titulo: 'El presupuesto está frenando la campaña',
    detalle: `${partes.join('; ')} (últimos 7 días).`,
    accion:
      'Si el CPA real está bien, subir el presupuesto diario; si no, recortar palabras caras antes.',
  };
}

export function alertaFueraDeZona(e: EntradaRendimiento): AlertaDto | null {
  const geo = e.segmentos.filter(
    (s) => s.dimension.startsWith('ciudad_') && s.clave !== SIN_CIUDAD,
  );
  if (diasConDatos(geo) < DIAS_POR_SEMANA) return null;
  const total = sumar(geo).gasto;
  const fuera = sumar(
    geo.filter(
      (s) => s.dimension === 'ciudad_interes' || s.clave !== CIUDAD_NEGOCIO,
    ),
  ).gasto;
  const fraccion = dividir(fuera, total);
  if (fraccion === null || fraccion <= FUERA_ZONA_MAX) return null;
  return {
    codigo: 'FUERA_ZONA',
    severidad: 'baja',
    titulo: 'Gasto fuera de la zona de reparto',
    detalle: `${pct(fraccion)} del gasto fue fuera de Riohacha o a gente "interesada" que no está allí.`,
    accion:
      'En la campaña: Ubicaciones → Opciones → "Presencia: personas en tus ubicaciones".',
  };
}

export function alertaFueraDeHorario(e: EntradaRendimiento): AlertaDto | null {
  const horas = e.segmentos.filter((s) => s.dimension === 'hora');
  if (diasConDatos(horas) < DIAS_POR_SEMANA) return null;
  const total = sumar(horas).gasto;
  const fuera = sumar(
    horas.filter((s) => {
      const h = Number(s.clave);
      // Desde las 11 a.m. el bot ya toma pedidos (reservas): no es desperdicio.
      return h < HORA_INICIO_PEDIDOS_BOT || h >= HORA_CIERRE;
    }),
  ).gasto;
  const fraccion = dividir(fuera, total);
  if (fraccion === null || fraccion <= FUERA_HORARIO_MAX) return null;
  return {
    codigo: 'FUERA_HORARIO',
    severidad: 'baja',
    titulo: 'Gasto fuera del horario del local',
    detalle: `${pct(fraccion)} del gasto fue antes de las 11 a.m. o después de las 11 p.m.`,
    accion:
      'Revisar la programación de anuncios: el bot toma pedidos de 11 a.m. a 11 p.m.',
  };
}
