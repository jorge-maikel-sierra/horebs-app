import {
  cuotaImpresiones,
  derivar,
  diaSemana,
  diasEntre,
  esMarca,
  rangoAnterior,
  recorrerDias,
  sumar,
  wilsonInferior,
} from './google-ads-metricas';
import type { FilaCampanaDia } from './google-ads.tipos';

function dia(parcial: Partial<FilaCampanaDia>): FilaCampanaDia {
  return {
    fecha: '2026-11-22',
    campana_id: '1',
    campana_nombre: 'C',
    estado: 'ENABLED',
    estado_principal: 'ELIGIBLE',
    motivos_estado: [],
    estrategia_puja: null,
    estado_puja: null,
    presupuesto_diario: 10000,
    gasto: 0,
    impresiones: 0,
    clics: 0,
    conversiones: 0,
    valor_conversiones: 0,
    llamadas: 0,
    is_busqueda: null,
    is_perdida_presupuesto: null,
    is_perdida_ranking: null,
    is_superior: null,
    is_superior_absoluta: null,
    ...parcial,
  };
}

describe('derivar', () => {
  it('calcula CTR, CPC, CVR y CPA', () => {
    const m = derivar({
      gasto: 10000,
      impresiones: 400,
      clics: 8,
      conversiones: 2,
    });
    expect(m).toMatchObject({ ctr: 0.02, cpc: 1250, cvr: 0.25, cpa: 5000 });
  });

  it('sin denominador la tasa es null, no 0', () => {
    const m = derivar({ gasto: 0, impresiones: 0, clics: 0, conversiones: 0 });
    expect(m).toMatchObject({ ctr: null, cpc: null, cvr: null, cpa: null });
  });

  it('marca muestra insuficiente con poco volumen', () => {
    expect(
      derivar({ gasto: 1, impresiones: 199, clics: 29, conversiones: 4 })
        .muestra,
    ).toEqual({ ctr: false, cvr: false, cpa: false });
    expect(
      derivar({ gasto: 1, impresiones: 200, clics: 30, conversiones: 5 })
        .muestra,
    ).toEqual({ ctr: true, cvr: true, cpa: true });
  });

  it('sumar acepta números que llegan como texto desde Postgres', () => {
    const t = sumar([
      {
        gasto: '100' as unknown as number,
        impresiones: 1,
        clics: 1,
        conversiones: 0,
      },
      { gasto: 50, impresiones: 2, clics: 0, conversiones: 1 },
    ]);
    expect(t).toEqual({
      gasto: 150,
      impresiones: 3,
      clics: 1,
      conversiones: 1,
    });
  });
});

describe('cuotaImpresiones', () => {
  it('pondera por impresiones elegibles en vez de promediar porcentajes', () => {
    // Día A: 100 impresiones con 50% → 200 elegibles; día B: 10 con 10% → 100.
    const c = cuotaImpresiones([
      dia({ impresiones: 100, is_busqueda: 0.5, is_perdida_presupuesto: 0.4 }),
      dia({ impresiones: 10, is_busqueda: 0.1, is_perdida_presupuesto: 0.1 }),
    ]);
    expect(c.busqueda).toBeCloseTo(110 / 300, 4);
    expect(c.perdida_presupuesto).toBeCloseTo((200 * 0.4 + 100 * 0.1) / 300, 4);
  });

  it('marca los valores acotados de Google', () => {
    const c = cuotaImpresiones([dia({ impresiones: 5, is_busqueda: 0.0999 })]);
    expect(c.acotada_inferior).toBe(true);
    expect(c.acotada_superior).toBe(false);
  });

  it('sin cuota reportada devuelve null', () => {
    expect(cuotaImpresiones([dia({ impresiones: 3 })]).busqueda).toBeNull();
  });
});

describe('fechas', () => {
  it('rangoAnterior tiene la misma duración y termina antes', () => {
    expect(rangoAnterior('2026-11-01', '2026-11-28')).toEqual({
      desde: '2026-10-04',
      hasta: '2026-10-31',
    });
    expect(diasEntre('2026-11-01', '2026-11-28')).toBe(28);
  });

  it('diaSemana empieza en lunes', () => {
    expect(diaSemana('2026-11-23')).toBe(0); // lunes
    expect(diaSemana('2026-11-22')).toBe(6); // domingo
  });

  it('recorrerDias incluye ambos extremos', () => {
    expect(recorrerDias('2026-11-20', '2026-11-22')).toEqual([
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });
});

describe('esMarca', () => {
  it('reconoce la marca con o sin tilde y mayúsculas', () => {
    expect(esMarca('Pizzería Horébs')).toBe(true);
    expect(esMarca('horebs riohacha')).toBe(true);
    expect(esMarca('pizza a domicilio')).toBe(false);
  });
});

describe('wilsonInferior', () => {
  it('con poca muestra el mínimo creíble queda lejos de la tasa observada', () => {
    expect(wilsonInferior(1, 2)).toBeLessThan(0.2);
    expect(wilsonInferior(500, 1000)).toBeGreaterThan(0.46);
    expect(wilsonInferior(0, 0)).toBeNull();
  });
});
