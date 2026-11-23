import { fechaBogota } from '../common/horario';
import {
  alertaSincronizacion,
  alertasAnuncios,
  alertasSinServir,
  ordenarAlertas,
  type AlertaDto,
} from './google-ads-alertas';
import {
  alertaFueraDeHorario,
  alertaFueraDeZona,
  alertaGastoSinConversion,
  alertaPresupuesto,
  horasDeAgotamiento,
  type EntradaRendimiento,
} from './google-ads-alertas-rendimiento';
import {
  alertaCpaAlto,
  alertaCtrCae,
  alertaEtiquetaRota,
  alertaQsBajo,
} from './google-ads-alertas-tendencia';
import {
  resumenNegocio,
  ritmoDelMes,
  type FilaPedidoAds,
  type NegocioDto,
  type RitmoDto,
} from './google-ads-atribucion';
import {
  MIN_CLICS_CVR,
  MIN_CONVERSIONES_CPA,
  MIN_IMPRESIONES_CTR,
  cuotaImpresiones,
  derivar,
  dividir,
  enRango,
  recorrerDias,
  redondear,
  sumar,
  type CuotaImpresionesDto,
  type MetricasDto,
} from './google-ads-metricas';
import {
  seccionCampanas,
  seccionDispositivos,
  seccionGeo,
  seccionHoras,
  seccionPalabras,
  seccionTerminos,
  type CampanaDto,
  type GeoDto,
  type PalabraDto,
  type SegmentoDto,
  type TerminosDto,
} from './google-ads-secciones';
import type {
  AccionConversionDto,
  CeldaHoraDto,
  FilaAnuncio,
  FilaCampanaDia,
  FilaConversionDia,
  FilaPalabraDia,
  FilaSegmentoDia,
  FilaTerminoDia,
  PuntoSerieDto,
} from './google-ads.tipos';

/** Arma el tablero completo a partir de las filas ya leídas (puro). */

export interface Rango {
  desde: string;
  hasta: string;
}

export interface DatosTableroAds {
  actual: Rango;
  anterior: Rango;
  ahora: Date;
  ultimoEnvio: string | null;
  /** Desde el inicio del período anterior (o del mes, si es antes). */
  campanas: FilaCampanaDia[];
  palabras: FilaPalabraDia[];
  terminos: FilaTerminoDia[];
  segmentos: FilaSegmentoDia[];
  conversiones: FilaConversionDia[];
  anuncios: FilaAnuncio[];
  pedidos: FilaPedidoAds[];
  gastoMeta: { fecha: string; gasto: number | string }[];
  clientesNuevos: { created_at: string }[];
}

export type ResumenAdsDto = MetricasDto & {
  valor_conversiones: number;
  llamadas: number;
  roas_ads: number | null;
  cuota: CuotaImpresionesDto;
};

export interface TableroGoogleAdsDto {
  desde: string;
  hasta: string;
  anterior: Rango;
  sincronizacion: { ultimo_envio: string | null; datos_hasta: string | null };
  muestra_minima: {
    impresiones_ctr: number;
    clics_cvr: number;
    conversiones_cpa: number;
  };
  resumen: ResumenAdsDto;
  resumen_anterior: ResumenAdsDto;
  serie: PuntoSerieDto[];
  conversiones: AccionConversionDto[];
  negocio: NegocioDto;
  negocio_anterior: NegocioDto;
  ritmo: RitmoDto;
  campanas: CampanaDto[];
  palabras: PalabraDto[];
  terminos: TerminosDto;
  horas: CeldaHoraDto[];
  agotamiento: { fecha: string; hora: number }[];
  dispositivos: SegmentoDto[];
  geo: GeoDto;
  anuncios: FilaAnuncio[];
  alertas: AlertaDto[];
}

const en = <T extends { fecha: string }>(filas: T[], r: Rango): T[] =>
  filas.filter((f) => enRango(f.fecha, r.desde, r.hasta));

export function resumenAds(filas: FilaCampanaDia[]): ResumenAdsDto {
  const valor = filas.reduce((s, f) => s + Number(f.valor_conversiones), 0);
  const total = sumar(filas);
  const roas = dividir(valor, total.gasto);
  return {
    ...derivar(total),
    valor_conversiones: redondear(valor, 0),
    llamadas: filas.reduce((s, f) => s + Number(f.llamadas), 0),
    roas_ads: roas === null ? null : redondear(roas),
    cuota: cuotaImpresiones(filas),
  };
}

export function serieDiaria(
  filas: FilaCampanaDia[],
  r: Rango,
): PuntoSerieDto[] {
  const porDia = new Map<string, FilaCampanaDia[]>();
  for (const f of filas)
    porDia.set(f.fecha, [...(porDia.get(f.fecha) ?? []), f]);
  return recorrerDias(r.desde, r.hasta).map((fecha) => {
    const t = sumar(porDia.get(fecha) ?? []);
    return {
      fecha,
      gasto: redondear(t.gasto, 0),
      impresiones: t.impresiones,
      clics: t.clics,
      conversiones: redondear(t.conversiones),
    };
  });
}

export function conversionesPorAccion(
  filas: FilaConversionDia[],
  actual: Rango,
  anterior: Rango,
): AccionConversionDto[] {
  const acciones = new Map<string, AccionConversionDto>();
  for (const f of filas) {
    const a = acciones.get(f.accion) ?? {
      accion: f.accion,
      categoria: f.categoria,
      conversiones: 0,
      valor: 0,
      conversiones_anterior: 0,
    };
    if (enRango(f.fecha, actual.desde, actual.hasta)) {
      a.conversiones = redondear(a.conversiones + Number(f.conversiones));
      a.valor = redondear(a.valor + Number(f.valor), 0);
    } else if (enRango(f.fecha, anterior.desde, anterior.hasta)) {
      a.conversiones_anterior = redondear(
        a.conversiones_anterior + Number(f.conversiones),
      );
    }
    acciones.set(f.accion, a);
  }
  return [...acciones.values()].sort((a, b) => b.conversiones - a.conversiones);
}

function negocioDe(d: DatosTableroAds, r: Rango): NegocioDto {
  const delRango = (iso: string): boolean =>
    enRango(fechaBogota(new Date(iso)), r.desde, r.hasta);
  return resumenNegocio({
    pedidos: d.pedidos.filter((p) => delRango(p.created_at)),
    gastoGoogle: sumar(en(d.campanas, r)).gasto,
    gastoMeta: en(d.gastoMeta, r).reduce((s, g) => s + Number(g.gasto), 0),
    clientesNuevos: d.clientesNuevos.filter((c) => delRango(c.created_at))
      .length,
  });
}

function alertas(
  d: DatosTableroAds,
  campanas: FilaCampanaDia[],
  secciones: {
    palabras: PalabraDto[];
    terminos: TerminosDto;
    serie: PuntoSerieDto[];
  },
): AlertaDto[] {
  const e: EntradaRendimiento = {
    hasta: d.actual.hasta,
    campanas,
    serie: secciones.serie,
    palabras: secciones.palabras.map((p) => ({ ...p, nombre: p.texto })),
    terminos: secciones.terminos.lista.map((t) => ({
      ...t,
      nombre: t.termino,
    })),
    segmentos: d.segmentos,
    conversiones: en(d.conversiones, d.actual),
  };
  const candidatas = [
    alertaSincronizacion(d.ultimoEnvio, d.ahora),
    ...alertasSinServir(campanas),
    ...alertasAnuncios(d.anuncios),
    alertaGastoSinConversion(e),
    alertaPresupuesto(e),
    alertaFueraDeZona(e),
    alertaFueraDeHorario(e),
    alertaCpaAlto(e),
    alertaCtrCae(e),
    alertaQsBajo(e),
    alertaEtiquetaRota(e),
  ];
  return ordenarAlertas(candidatas.filter((a): a is AlertaDto => a !== null));
}

export function armarTablero(d: DatosTableroAds): TableroGoogleAdsDto {
  const actuales = en(d.campanas, d.actual);
  const gastoActual = sumar(actuales).gasto;
  const serie = serieDiaria(actuales, d.actual);
  const palabras = seccionPalabras(en(d.palabras, d.actual));
  const terminos = seccionTerminos(en(d.terminos, d.actual), gastoActual);
  const segmentos = en(d.segmentos, d.actual);
  return {
    desde: d.actual.desde,
    hasta: d.actual.hasta,
    anterior: d.anterior,
    sincronizacion: {
      ultimo_envio: d.ultimoEnvio,
      datos_hasta: d.campanas.reduce<string | null>(
        (max, f) => (max === null || f.fecha > max ? f.fecha : max),
        null,
      ),
    },
    muestra_minima: {
      impresiones_ctr: MIN_IMPRESIONES_CTR,
      clics_cvr: MIN_CLICS_CVR,
      conversiones_cpa: MIN_CONVERSIONES_CPA,
    },
    resumen: resumenAds(actuales),
    resumen_anterior: resumenAds(en(d.campanas, d.anterior)),
    serie,
    conversiones: conversionesPorAccion(d.conversiones, d.actual, d.anterior),
    negocio: negocioDe(d, d.actual),
    negocio_anterior: negocioDe(d, d.anterior),
    ritmo: ritmoDelMes(d.campanas, d.actual.hasta),
    campanas: seccionCampanas(actuales),
    palabras,
    terminos,
    horas: seccionHoras(segmentos),
    agotamiento: [...horasDeAgotamiento(segmentos, actuales).entries()]
      .map(([fecha, hora]) => ({ fecha, hora }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    dispositivos: seccionDispositivos(segmentos),
    geo: seccionGeo(segmentos),
    anuncios: d.anuncios,
    alertas: alertas({ ...d, segmentos }, actuales, {
      palabras,
      terminos,
      serie,
    }),
  };
}
