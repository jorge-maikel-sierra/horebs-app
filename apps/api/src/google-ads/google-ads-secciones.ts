import { CIUDAD_NEGOCIO } from './google-ads-alertas-rendimiento';
import {
  agruparMetricas,
  cuotaImpresiones,
  derivar,
  diaSemana,
  dividir,
  esMarca,
  redondear,
  sumar,
  DECIMALES_TASA,
  type CuotaImpresionesDto,
  type MetricasDto,
} from './google-ads-metricas';
import type {
  CampanaTableroDto,
  CeldaHoraDto,
  CiudadDto,
  FilaCampanaDia,
  FilaPalabraDia,
  FilaSegmentoDia,
  FilaTerminoDia,
  PalabraTableroDto,
  TerminoTableroDto,
} from './google-ads.tipos';

/** Secciones del tablero (puras): campañas, palabras, términos y segmentos. */

export const MAX_TERMINOS = 50;
/** Clics mínimos para sugerir un término como negativa. */
export const CLICS_CANDIDATA_NEGATIVA = 3;

export type CampanaDto = CampanaTableroDto &
  MetricasDto & { cuota: CuotaImpresionesDto };
export type PalabraDto = PalabraTableroDto & MetricasDto;
export type TerminoDto = TerminoTableroDto & MetricasDto;
export type SegmentoDto = MetricasDto & { clave: string };

export interface TerminosDto {
  lista: TerminoDto[];
  /** Lo que queda fuera de los 50 de más gasto, sumado. */
  resto: MetricasDto & { terminos: number };
  marca: MetricasDto;
  generico: MetricasDto;
  candidatas_negativas: string[];
  /** Gasto que Google no muestra con su término (bajo volumen). */
  gasto_sin_termino: number | null;
}

export interface GeoDto {
  ciudades: CiudadDto[];
  fuera_zona: number | null;
  por_interes: number | null;
}

function masReciente<T extends { fecha: string }>(filas: T[]): T {
  return filas.reduce((a, b) => (b.fecha > a.fecha ? b : a));
}

export function seccionCampanas(filas: FilaCampanaDia[]): CampanaDto[] {
  const porCampana = new Map<string, FilaCampanaDia[]>();
  for (const f of filas) {
    porCampana.set(f.campana_id, [...(porCampana.get(f.campana_id) ?? []), f]);
  }
  return [...porCampana.values()]
    .map((dias) => {
      const ultima = masReciente(dias);
      return {
        campana_id: ultima.campana_id,
        nombre: ultima.campana_nombre,
        estado: ultima.estado,
        estado_principal: ultima.estado_principal,
        motivos_estado: ultima.motivos_estado ?? [],
        estrategia_puja: ultima.estrategia_puja,
        estado_puja: ultima.estado_puja,
        presupuesto_diario: Number(ultima.presupuesto_diario),
        ...derivar(sumar(dias)),
        cuota: cuotaImpresiones(dias),
      };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

export function seccionPalabras(filas: FilaPalabraDia[]): PalabraDto[] {
  const grupos = agruparMetricas(
    filas,
    (f) => `${f.grupo_id}:${f.criterio_id}`,
  );
  return [...grupos.entries()]
    .map(([clave, g]) => {
      const propias = filas.filter(
        (f) => `${f.grupo_id}:${f.criterio_id}` === clave,
      );
      const ultima = masReciente(propias);
      const conQs = propias.filter((f) => f.qs !== null);
      const qs = conQs.length > 0 ? masReciente(conQs) : null;
      return {
        clave,
        texto: ultima.texto,
        concordancia: ultima.concordancia,
        estado: ultima.estado,
        qs: qs ? Number(qs.qs) : null,
        qs_ctr: qs?.qs_ctr ?? null,
        qs_anuncio: qs?.qs_anuncio ?? null,
        qs_pagina: qs?.qs_pagina ?? null,
        ...derivar(g.total),
      };
    })
    .sort((a, b) => b.gasto - a.gasto);
}

function aTermino(primera: FilaTerminoDia, total: MetricasDto): TerminoDto {
  const marca = esMarca(primera.termino);
  return {
    termino: primera.termino,
    estado: primera.estado,
    marca,
    candidata_negativa:
      !marca &&
      total.conversiones === 0 &&
      total.clics >= CLICS_CANDIDATA_NEGATIVA &&
      primera.estado !== 'EXCLUDED',
    ...total,
  };
}

export function seccionTerminos(
  filas: FilaTerminoDia[],
  gastoCampanas: number,
): TerminosDto {
  const grupos = agruparMetricas(filas, (f) => f.termino.toLowerCase());
  const todos = [...grupos.values()]
    .map((g) => aTermino(g.primera, derivar(g.total)))
    .sort((a, b) => b.gasto - a.gasto);
  const resto = todos.slice(MAX_TERMINOS);
  const gastoTerminos = sumar(filas).gasto;
  const sinTermino = dividir(gastoCampanas - gastoTerminos, gastoCampanas);
  return {
    lista: todos.slice(0, MAX_TERMINOS),
    resto: { ...derivar(sumar(resto)), terminos: resto.length },
    marca: derivar(sumar(filas.filter((f) => esMarca(f.termino)))),
    generico: derivar(sumar(filas.filter((f) => !esMarca(f.termino)))),
    candidatas_negativas: todos
      .filter((t) => t.candidata_negativa)
      .map((t) => t.termino),
    gasto_sin_termino:
      sinTermino === null
        ? null
        : redondear(Math.max(0, sinTermino), DECIMALES_TASA),
  };
}

export function seccionHoras(segmentos: FilaSegmentoDia[]): CeldaHoraDto[] {
  const grupos = agruparMetricas(
    segmentos.filter((s) => s.dimension === 'hora'),
    (s) => `${diaSemana(s.fecha)}:${s.clave}`,
  );
  return [...grupos.entries()].map(([clave, g]) => {
    const [dia, hora] = clave.split(':').map(Number);
    return {
      dia,
      hora,
      gasto: redondear(g.total.gasto, 0),
      clics: g.total.clics,
      conversiones: redondear(g.total.conversiones),
    };
  });
}

export function seccionDispositivos(
  segmentos: FilaSegmentoDia[],
): SegmentoDto[] {
  const grupos = agruparMetricas(
    segmentos.filter((s) => s.dimension === 'dispositivo'),
    (s) => s.clave,
  );
  return [...grupos.entries()]
    .map(([clave, g]) => ({ clave, ...derivar(g.total) }))
    .sort((a, b) => b.gasto - a.gasto);
}

export function seccionGeo(segmentos: FilaSegmentoDia[]): GeoDto {
  const geo = segmentos.filter((s) => s.dimension.startsWith('ciudad_'));
  const grupos = agruparMetricas(geo, (s) => `${s.dimension}:${s.clave}`);
  const ciudades: CiudadDto[] = [...grupos.values()]
    .map(({ primera, total }) => ({
      nombre: primera.clave,
      tipo:
        primera.dimension === 'ciudad_interes'
          ? ('interes' as const)
          : ('presencia' as const),
      gasto: redondear(total.gasto, 0),
      clics: total.clics,
      conversiones: redondear(total.conversiones),
    }))
    .sort((a, b) => b.gasto - a.gasto);
  const total = sumar(geo).gasto;
  const interes = sumar(geo.filter((s) => s.dimension === 'ciudad_interes'));
  const fuera = sumar(
    geo.filter(
      (s) => s.dimension === 'ciudad_interes' || s.clave !== CIUDAD_NEGOCIO,
    ),
  );
  const fraccion = (n: number): number | null => {
    const v = dividir(n, total);
    return v === null ? null : redondear(v, DECIMALES_TASA);
  };
  return {
    ciudades,
    fuera_zona: fraccion(fuera.gasto),
    por_interes: fraccion(interes.gasto),
  };
}
