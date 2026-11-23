import {
  armarTablero,
  conversionesPorAccion,
  serieDiaria,
  type DatosTableroAds,
} from './google-ads-tablero';
import type { FilaCampanaDia } from './google-ads.tipos';

function dia(fecha: string, gasto: number): FilaCampanaDia {
  return {
    fecha,
    campana_id: '1',
    campana_nombre: 'Búsqueda - Pizza Riohacha',
    estado: 'ENABLED',
    estado_principal: 'ELIGIBLE',
    motivos_estado: [],
    estrategia_puja: 'MAXIMIZE_CLICKS',
    estado_puja: null,
    presupuesto_diario: 10000,
    gasto,
    impresiones: 100,
    clics: 8,
    conversiones: 1,
    valor_conversiones: 48000,
    llamadas: 0,
    is_busqueda: 0.5,
    is_perdida_presupuesto: 0.2,
    is_perdida_ranking: 0.3,
    is_superior: null,
    is_superior_absoluta: null,
  };
}

function datos(parcial: Partial<DatosTableroAds> = {}): DatosTableroAds {
  return {
    actual: { desde: '2026-11-21', hasta: '2026-11-22' },
    anterior: { desde: '2026-11-19', hasta: '2026-11-20' },
    ahora: new Date('2026-11-23T12:00:00Z'),
    ultimoEnvio: '2026-11-23T11:00:00Z',
    campanas: [],
    palabras: [],
    terminos: [],
    segmentos: [],
    conversiones: [],
    anuncios: [],
    estados: [],
    cambios: [],
    pedidos: [],
    gastoMeta: [],
    clientesNuevos: [],
    ...parcial,
  };
}

describe('serieDiaria', () => {
  it('rellena los días sin gasto con 0', () => {
    const s = serieDiaria([dia('2026-11-22', 500)], {
      desde: '2026-11-21',
      hasta: '2026-11-22',
    });
    expect(s.map((p) => p.gasto)).toEqual([0, 500]);
  });
});

describe('conversionesPorAccion', () => {
  it('separa el período actual del anterior', () => {
    const c = conversionesPorAccion(
      [
        {
          fecha: '2026-11-22',
          campana_id: '1',
          accion: 'Pedido',
          categoria: 'PURCHASE',
          conversiones: 2,
          valor: 96000,
        },
        {
          fecha: '2026-11-19',
          campana_id: '1',
          accion: 'Pedido',
          categoria: 'PURCHASE',
          conversiones: 1,
          valor: 48000,
        },
        {
          fecha: '2026-11-21',
          campana_id: '1',
          accion: 'Clic WhatsApp',
          categoria: 'CONTACT',
          conversiones: 1,
          valor: 0,
        },
      ],
      { desde: '2026-11-21', hasta: '2026-11-22' },
      { desde: '2026-11-19', hasta: '2026-11-20' },
    );
    expect(c[0]).toEqual({
      accion: 'Pedido',
      categoria: 'PURCHASE',
      conversiones: 2,
      valor: 96000,
      conversiones_anterior: 1,
    });
  });
});

describe('armarTablero', () => {
  it('lista los cambios del período del más reciente al más viejo', () => {
    const cambio = (momento: string) => ({
      recurso_cambio: `customers/1/changeEvents/${momento}`,
      fecha: momento.slice(0, 10),
      momento,
      campana_id: '1',
      tipo_recurso: 'CAMPAIGN_BUDGET',
      operacion: 'UPDATE',
      campos: ['amount_micros'],
    });
    const t = armarTablero(
      datos({
        cambios: [
          cambio('2026-11-21 10:00:00'),
          cambio('2026-11-22 09:00:00'),
          cambio('2026-11-19 08:00:00'),
        ],
      }),
    );
    expect(t.cambios.map((c) => c.momento)).toEqual([
      '2026-11-22 09:00:00',
      '2026-11-21 10:00:00',
    ]);
  });

  it('sin datos devuelve un tablero vacío con la alerta de sincronización', () => {
    const t = armarTablero(datos({ ultimoEnvio: null }));
    expect(t.resumen.gasto).toBe(0);
    expect(t.serie).toHaveLength(2);
    expect(t.sincronizacion.datos_hasta).toBeNull();
    expect(t.alertas.map((a) => a.codigo)).toEqual(['SINCRONIZACION_VIEJA']);
  });

  it('separa período actual y anterior y cruza con pedidos y Meta', () => {
    const t = armarTablero(
      datos({
        campanas: [
          dia('2026-11-20', 4000),
          dia('2026-11-21', 6000),
          dia('2026-11-22', 4000),
        ],
        pedidos: [
          {
            id: 'a',
            total: 50000,
            estado: 'entregado',
            // 22 nov a las 8 p.m. en Bogotá es 23 nov en UTC: debe contar el 22.
            created_at: '2026-11-23T01:00:00Z',
            origen_fuente: null,
            origen_campana_id: null,
            atribucion_web: { utm_source: 'google', utm_medium: 'cpc' },
          },
        ],
        gastoMeta: [{ fecha: '2026-11-22', gasto: '10000' }],
      }),
    );
    expect(t.resumen.gasto).toBe(10000);
    expect(t.resumen_anterior.gasto).toBe(4000);
    expect(t.negocio).toMatchObject({
      pedidos: 1,
      pedidos_google: 1,
      gasto_meta: 10000,
      roas_combinado: 2.5,
    });
    expect(t.negocio_anterior.pedidos).toBe(0);
    expect(t.campanas[0].gasto).toBe(10000);
    expect(t.sincronizacion.datos_hasta).toBe('2026-11-22');
  });
});
