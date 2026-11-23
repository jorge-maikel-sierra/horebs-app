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
import { recorrerDias } from './google-ads-metricas';
import type {
  FilaAnuncio,
  FilaCampanaDia,
  FilaSegmentoDia,
} from './google-ads.tipos';

const HASTA = '2026-11-28';
const SEMANA = recorrerDias('2026-11-22', HASTA);

function campana(parcial: Partial<FilaCampanaDia>): FilaCampanaDia {
  return {
    fecha: HASTA,
    campana_id: '1',
    campana_nombre: 'Búsqueda - Pizza Riohacha',
    estado: 'ENABLED',
    estado_principal: 'ELIGIBLE',
    motivos_estado: [],
    estrategia_puja: null,
    estado_puja: null,
    presupuesto_diario: 10000,
    gasto: 0,
    impresiones: 100,
    clics: 0,
    conversiones: 0,
    valor_conversiones: 0,
    llamadas: 0,
    is_busqueda: 0.5,
    is_perdida_presupuesto: 0,
    is_perdida_ranking: 0.5,
    is_superior: null,
    is_superior_absoluta: null,
    ...parcial,
  };
}

function segmento(parcial: Partial<FilaSegmentoDia>): FilaSegmentoDia {
  return {
    fecha: HASTA,
    campana_id: '1',
    dimension: 'hora',
    clave: '18',
    gasto: 0,
    impresiones: 0,
    clics: 0,
    conversiones: 0,
    ...parcial,
  };
}

function entrada(parcial: Partial<EntradaRendimiento>): EntradaRendimiento {
  return {
    hasta: HASTA,
    campanas: [],
    serie: [],
    palabras: [],
    terminos: [],
    segmentos: [],
    conversiones: [],
    ...parcial,
  };
}

const anuncio = (parcial: Partial<FilaAnuncio>): FilaAnuncio => ({
  grupo_id: '1',
  anuncio_id: '9',
  campana_id: '1',
  tipo: 'RESPONSIVE_SEARCH_AD',
  estado: 'ENABLED',
  fuerza: 'GOOD',
  aprobacion: 'APPROVED',
  urls_finales: ['https://pizzeriahorebs.shop/'],
  ...parcial,
});

describe('alertas de estado', () => {
  const ahora = new Date('2026-11-29T12:00:00Z');

  it('avisa si nunca llegaron datos o si llevan más de 36 h', () => {
    expect(alertaSincronizacion(null, ahora)?.codigo).toBe(
      'SINCRONIZACION_VIEJA',
    );
    expect(alertaSincronizacion('2026-11-27T12:00:00Z', ahora)).not.toBeNull();
    expect(alertaSincronizacion('2026-11-29T06:00:00Z', ahora)).toBeNull();
  });

  it('sin foto de estado usa el último día con datos', () => {
    const viejo = campana({
      fecha: '2026-11-27',
      estado_principal: 'NOT_ELIGIBLE',
    });
    expect(alertasSinServir([], [viejo, campana({})], HASTA)).toEqual([]);
    expect(
      alertasSinServir(
        [],
        [campana({ estado_principal: 'MISCONFIGURED' })],
        HASTA,
      )[0].severidad,
    ).toBe('critica');
    expect(
      alertasSinServir(
        [],
        [campana({ estado: 'PAUSED', estado_principal: 'PAUSED' })],
        HASTA,
      ),
    ).toEqual([]);
  });

  it('con la foto avisa aunque Google no haya mandado fila del día', () => {
    // El 28 no sirvió: Google no devuelve fila, la última es del 27 y era apta.
    const ayer = campana({ fecha: '2026-11-27' });
    const foto = {
      ...campana({}),
      estado_principal: 'NOT_ELIGIBLE',
      motivos_estado: ['HAS_ADS_DISAPPROVED'],
    };
    const [a] = alertasSinServir([foto], [ayer], HASTA);
    expect(a.detalle).toContain('HAS_ADS_DISAPPROVED');
  });

  it('avisa si la campaña activa no tuvo impresiones el último día', () => {
    const foto = campana({});
    expect(
      alertasSinServir([foto], [campana({ fecha: '2026-11-27' })], HASTA)[0]
        .detalle,
    ).toContain('sin impresiones');
    expect(alertasSinServir([foto], [campana({})], HASTA)).toEqual([]);
  });

  it('avisa de anuncios rechazados, URL ajena y fuerza baja', () => {
    const codigos = alertasAnuncios([
      anuncio({ aprobacion: 'DISAPPROVED' }),
      anuncio({ urls_finales: ['https://pizzeriahorebs.com/'] }),
      anuncio({ fuerza: 'POOR' }),
    ]).map((a) => a.codigo);
    expect(codigos).toEqual([
      'ANUNCIO_RECHAZADO',
      'URL_PROHIBIDA',
      'FUERZA_ANUNCIO',
    ]);
  });

  it('un anuncio sano o pausado no genera alertas', () => {
    expect(alertasAnuncios([anuncio({})])).toEqual([]);
    expect(
      alertasAnuncios([
        anuncio({ estado: 'PAUSED', aprobacion: 'DISAPPROVED' }),
      ]),
    ).toEqual([]);
  });

  it('ordena de crítica a baja', () => {
    const a = (severidad: AlertaDto['severidad']): AlertaDto => ({
      codigo: severidad,
      severidad,
      titulo: '',
      detalle: '',
      accion: '',
    });
    expect(
      ordenarAlertas([a('baja'), a('critica'), a('media'), a('alta')]).map(
        (x) => x.severidad,
      ),
    ).toEqual(['critica', 'alta', 'media', 'baja']);
  });
});

describe('alertas de rendimiento', () => {
  it('gasto sin conversión solo con 20 clics o más', () => {
    const t = (clics: number) => ({
      nombre: 'receta pizza',
      gasto: 20000,
      impresiones: 100,
      clics,
      conversiones: 0,
    });
    expect(alertaGastoSinConversion(entrada({ terminos: [t(19)] }))).toBeNull();
    expect(
      alertaGastoSinConversion(entrada({ terminos: [t(20)] }))?.detalle,
    ).toContain('receta pizza');
  });

  it('presupuesto limita por cuota perdida con 7 días de datos', () => {
    const dias = SEMANA.map((fecha) =>
      campana({ fecha, is_perdida_presupuesto: 0.3 }),
    );
    expect(alertaPresupuesto(entrada({ campanas: dias }))?.codigo).toBe(
      'PRESUPUESTO_LIMITA',
    );
    expect(alertaPresupuesto(entrada({ campanas: dias.slice(1) }))).toBeNull();
  });

  it('presupuesto limita si se agota antes de las 9 p.m. 3 de 7 días', () => {
    const dias = SEMANA.map((fecha) => campana({ fecha }));
    const horas = SEMANA.slice(0, 3).map((fecha) =>
      segmento({ fecha, clave: '19', gasto: 9600 }),
    );
    expect(horasDeAgotamiento(horas, dias).get(SEMANA[0])).toBe(19);
    expect(
      alertaPresupuesto(entrada({ campanas: dias, segmentos: horas }))?.detalle,
    ).toContain('3 de 7 días');
  });

  it('fuera de zona y fuera de horario con más del umbral', () => {
    const geo = SEMANA.flatMap((fecha) => [
      segmento({
        fecha,
        dimension: 'ciudad_presencia',
        clave: 'Riohacha',
        gasto: 90,
      }),
      segmento({
        fecha,
        dimension: 'ciudad_presencia',
        clave: 'Maicao',
        gasto: 10,
      }),
    ]);
    expect(alertaFueraDeZona(entrada({ segmentos: geo }))?.codigo).toBe(
      'FUERA_ZONA',
    );
    const horas = SEMANA.flatMap((fecha) => [
      segmento({ fecha, clave: '9', gasto: 20 }),
      segmento({ fecha, clave: '19', gasto: 80 }),
    ]);
    expect(alertaFueraDeHorario(entrada({ segmentos: horas }))?.codigo).toBe(
      'FUERA_HORARIO',
    );
    expect(
      alertaFueraDeHorario(entrada({ segmentos: horas.slice(2) })),
    ).toBeNull();
  });
});

describe('alertas de tendencia', () => {
  const punto = (
    fecha: string,
    gasto: number,
    conversiones: number,
    extra = {},
  ) => ({
    fecha,
    gasto,
    impresiones: 100,
    clics: 10,
    conversiones,
    ...extra,
  });

  it('CPA alto solo con 5 conversiones de base', () => {
    const base = recorrerDias('2026-11-01', '2026-11-25').map((f) =>
      punto(f, 10000, 0.5),
    );
    const recientes = ['2026-11-26', '2026-11-27', '2026-11-28'].map((f) =>
      punto(f, 20000, 0),
    );
    expect(
      alertaCpaAlto(entrada({ serie: [...base, ...recientes] }))?.codigo,
    ).toBe('CPA_ALTO');
    expect(
      alertaCpaAlto(entrada({ serie: [...base.slice(0, 5), ...recientes] })),
    ).toBeNull();
  });

  it('CTR cae solo con 500 impresiones recientes', () => {
    const base = recorrerDias('2026-11-01', '2026-11-21').map((f) =>
      punto(f, 1, 0),
    );
    const caida = SEMANA.map((f) => punto(f, 1, 0, { clics: 2 }));
    expect(alertaCtrCae(entrada({ serie: [...base, ...caida] }))?.codigo).toBe(
      'CTR_CAE',
    );
    const pocas = SEMANA.map((f) =>
      punto(f, 1, 0, { clics: 0, impresiones: 50 }),
    );
    expect(alertaCtrCae(entrada({ serie: [...base, ...pocas] }))).toBeNull();
  });

  it('QS bajo solo con 100 impresiones', () => {
    const p = (impresiones: number) => ({
      nombre: 'pizza',
      gasto: 0,
      impresiones,
      clics: 0,
      conversiones: 0,
      qs: 3,
    });
    expect(alertaQsBajo(entrada({ palabras: [p(99)] }))).toBeNull();
    expect(alertaQsBajo(entrada({ palabras: [p(100)] }))?.codigo).toBe(
      'QS_BAJO',
    );
  });

  it('etiqueta rota: clics sin compras cuando antes sí había', () => {
    const conversiones = [
      {
        fecha: '2026-11-20',
        campana_id: '1',
        accion: 'Pedido',
        categoria: 'PURCHASE',
        conversiones: 2,
        valor: 96000,
      },
    ];
    const serie = ['2026-11-26', '2026-11-27', '2026-11-28'].map((f) =>
      punto(f, 1, 0),
    );
    expect(alertaEtiquetaRota(entrada({ serie, conversiones }))?.codigo).toBe(
      'ETIQUETA_ROTA',
    );
    expect(alertaEtiquetaRota(entrada({ serie, conversiones: [] }))).toBeNull();
  });
});
