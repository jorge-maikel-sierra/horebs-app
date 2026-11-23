import {
  seccionCampanas,
  seccionDispositivos,
  seccionGeo,
  seccionHoras,
  seccionPalabras,
  seccionTerminos,
} from './google-ads-secciones';
import type {
  FilaCampanaDia,
  FilaPalabraDia,
  FilaSegmentoDia,
  FilaTerminoDia,
} from './google-ads.tipos';

const m = { gasto: 0, impresiones: 0, clics: 0, conversiones: 0 };

const termino = (
  t: string,
  extra: Partial<FilaTerminoDia> = {},
): FilaTerminoDia => ({
  fecha: '2026-11-22',
  campana_id: '1',
  grupo_id: '2',
  termino: t,
  estado: 'NONE',
  ...m,
  ...extra,
});

const seg = (extra: Partial<FilaSegmentoDia>): FilaSegmentoDia => ({
  fecha: '2026-11-23',
  campana_id: '1',
  dimension: 'hora',
  clave: '18',
  ...m,
  ...extra,
});

describe('seccionCampanas', () => {
  it('suma los días y toma el estado del último', () => {
    const dia = (
      fecha: string,
      estado_principal: string,
      gasto: number,
    ): FilaCampanaDia => ({
      fecha,
      campana_id: '1',
      campana_nombre: 'C',
      estado: 'ENABLED',
      estado_principal,
      motivos_estado: [],
      estrategia_puja: null,
      estado_puja: null,
      presupuesto_diario: 10000,
      ...m,
      gasto,
      clics: 2,
      valor_conversiones: 0,
      llamadas: 0,
      is_busqueda: null,
      is_perdida_presupuesto: null,
      is_perdida_ranking: null,
      is_superior: null,
      is_superior_absoluta: null,
    });
    const [c] = seccionCampanas([
      dia('2026-11-21', 'LEARNING', 100),
      dia('2026-11-22', 'ELIGIBLE', 50),
    ]);
    expect(c).toMatchObject({
      estado_principal: 'ELIGIBLE',
      gasto: 150,
      clics: 4,
      cpc: 37.5,
    });
  });
});

describe('seccionPalabras', () => {
  it('agrupa por palabra y toma el último QS conocido', () => {
    const p = (fecha: string, qs: number | null): FilaPalabraDia => ({
      fecha,
      campana_id: '1',
      grupo_id: '2',
      criterio_id: '3',
      texto: 'pizza a domicilio',
      concordancia: 'PHRASE',
      estado: 'ENABLED',
      qs,
      qs_ctr: qs ? 'AVERAGE' : null,
      qs_anuncio: null,
      qs_pagina: null,
      ...m,
      clics: 1,
    });
    const [palabra] = seccionPalabras([
      p('2026-11-20', 6),
      p('2026-11-22', null),
    ]);
    expect(palabra).toMatchObject({ qs: 6, qs_ctr: 'AVERAGE', clics: 2 });
  });
});

describe('seccionTerminos', () => {
  it('separa marca, sugiere negativas y calcula el gasto sin término', () => {
    const t = seccionTerminos(
      [
        termino('receta pizza casera', { gasto: 3000, clics: 3 }),
        termino('pizzeria horebs', { gasto: 1000, clics: 5 }),
        termino('pizza domicilio', { gasto: 2000, clics: 4, conversiones: 1 }),
        termino('pizza gratis', { gasto: 500, clics: 3, estado: 'EXCLUDED' }),
      ],
      10000,
    );
    expect(t.lista.map((x) => x.termino)[0]).toBe('receta pizza casera');
    expect(t.candidatas_negativas).toEqual(['receta pizza casera']);
    expect(t.marca.gasto).toBe(1000);
    expect(t.generico.gasto).toBe(5500);
    expect(t.gasto_sin_termino).toBeCloseTo(0.35, 4);
  });

  it('deja en "resto" lo que pasa de 50 términos', () => {
    const muchos = Array.from({ length: 52 }, (_, i) =>
      termino(`t${i}`, { gasto: 100 - i }),
    );
    const t = seccionTerminos(muchos, 0);
    expect(t.lista).toHaveLength(50);
    expect(t.resto.terminos).toBe(2);
    expect(t.gasto_sin_termino).toBeNull();
  });
});

describe('segmentos', () => {
  it('mapa por día de semana y hora', () => {
    const horas = seccionHoras([
      seg({ gasto: 10 }),
      seg({ fecha: '2026-11-30', gasto: 5 }),
    ]);
    expect(horas).toEqual([
      { dia: 0, hora: 18, gasto: 15, clics: 0, conversiones: 0 },
    ]);
  });

  it('dispositivos ordenados por gasto', () => {
    const d = seccionDispositivos([
      seg({ dimension: 'dispositivo', clave: 'DESKTOP', gasto: 1 }),
      seg({ dimension: 'dispositivo', clave: 'MOBILE', gasto: 9 }),
    ]);
    expect(d.map((x) => x.clave)).toEqual(['MOBILE', 'DESKTOP']);
  });

  it('geo: fracción fuera de Riohacha y por interés', () => {
    const g = seccionGeo([
      seg({ dimension: 'ciudad_presencia', clave: 'Riohacha', gasto: 80 }),
      seg({ dimension: 'ciudad_presencia', clave: 'Maicao', gasto: 10 }),
      seg({ dimension: 'ciudad_interes', clave: 'Riohacha', gasto: 10 }),
    ]);
    expect(g.fuera_zona).toBeCloseTo(0.2, 4);
    const conSinCiudad = seccionGeo([
      seg({ dimension: 'ciudad_presencia', clave: 'Riohacha', gasto: 80 }),
      seg({ dimension: 'ciudad_presencia', clave: 'Sin ciudad', gasto: 20 }),
    ]);
    expect(conSinCiudad.fuera_zona).toBe(0);
    expect(g.por_interes).toBeCloseTo(0.1, 4);
    expect(g.ciudades[0]).toMatchObject({
      nombre: 'Riohacha',
      tipo: 'presencia',
    });
  });
});
