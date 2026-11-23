import {
  esPedidoGoogle,
  presupuestoVigente,
  resumenNegocio,
  ritmoDelMes,
  tieneOrigen,
  type FilaPedidoAds,
} from './google-ads-atribucion';
import type { FilaCampanaDia } from './google-ads.tipos';

function pedido(parcial: Partial<FilaPedidoAds>): FilaPedidoAds {
  return {
    id: 'p',
    total: 48000,
    estado: 'entregado',
    created_at: '2026-11-22T20:00:00-05:00',
    origen_fuente: null,
    origen_campana_id: null,
    atribucion_web: null,
    ...parcial,
  };
}

function campana(
  fecha: string,
  gasto: number,
  presupuesto = 10000,
): FilaCampanaDia {
  return {
    fecha,
    campana_id: '1',
    campana_nombre: 'C',
    estado: 'ENABLED',
    estado_principal: 'ELIGIBLE',
    motivos_estado: [],
    estrategia_puja: null,
    estado_puja: null,
    presupuesto_diario: presupuesto,
    gasto,
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
  };
}

describe('esPedidoGoogle', () => {
  it('reconoce UTM de Google, gclid, fuente del bot y la caja', () => {
    expect(
      esPedidoGoogle(pedido({ atribucion_web: { utm_source: 'Google' } })),
    ).toBe(true);
    expect(esPedidoGoogle(pedido({ atribucion_web: { gclid: 'abc' } }))).toBe(
      true,
    );
    expect(esPedidoGoogle(pedido({ origen_fuente: 'google_ads' }))).toBe(true);
    expect(esPedidoGoogle(pedido({ origen_campana_id: 'gads:123' }))).toBe(
      true,
    );
  });

  it('un pedido de Meta o sin origen no es de Google', () => {
    expect(
      esPedidoGoogle(pedido({ atribucion_web: { utm_source: 'facebook' } })),
    ).toBe(false);
    expect(esPedidoGoogle(pedido({ origen_campana_id: '120210' }))).toBe(false);
    expect(esPedidoGoogle(pedido({}))).toBe(false);
  });
});

describe('tieneOrigen', () => {
  it('cuenta cualquier origen conocido', () => {
    expect(tieneOrigen(pedido({ origen_fuente: 'ctwa' }))).toBe(true);
    expect(tieneOrigen(pedido({}))).toBe(false);
  });
});

describe('resumenNegocio', () => {
  it('combina gasto de Google y Meta y excluye cancelados', () => {
    const n = resumenNegocio({
      pedidos: [
        pedido({ total: '50000', atribucion_web: { utm_source: 'google' } }),
        pedido({ total: 50000 }),
        pedido({ total: 99000, estado: 'cancelado' }),
      ],
      gastoGoogle: 20000,
      gastoMeta: 30000,
      clientesNuevos: 2,
    });
    expect(n).toMatchObject({
      pedidos: 2,
      ventas: 100000,
      roas_combinado: 2,
      cpa_combinado: 25000,
      cac_combinado: 25000,
      pedidos_google: 1,
      cpa_google: 20000,
      roas_google: 2.5,
      cobertura: 0.5,
      cota_inferior: false,
    });
  });

  it('con poca cobertura el CPA de Google es solo una cota', () => {
    const n = resumenNegocio({
      pedidos: [
        pedido({ atribucion_web: { gclid: 'x' } }),
        pedido({}),
        pedido({}),
        pedido({}),
      ],
      gastoGoogle: 10000,
      gastoMeta: 0,
      clientesNuevos: 0,
    });
    expect(n.cobertura).toBe(0.25);
    expect(n.cota_inferior).toBe(true);
    expect(n.cac_combinado).toBeNull();
  });

  it('sin pedidos no divide por cero', () => {
    const n = resumenNegocio({
      pedidos: [],
      gastoGoogle: 0,
      gastoMeta: 0,
      clientesNuevos: 0,
    });
    expect(n).toMatchObject({
      roas_combinado: null,
      cpa_combinado: null,
      cobertura: null,
    });
  });
});

describe('ritmoDelMes', () => {
  it('proyecta el gasto del mes y lo compara con 30,4 × diario', () => {
    const filas = [
      campana('2026-10-31', 99999),
      campana('2026-11-09', 10000),
      campana('2026-11-10', 10000),
    ];
    const r = ritmoDelMes(filas, '2026-11-10');
    expect(r).toMatchObject({
      mes: '2026-11',
      gasto_mes: 20000,
      presupuesto_diario: 10000,
      presupuesto_mes: 304000,
      dias_transcurridos: 10,
      dias_mes: 30,
      proyeccion: 60000,
    });
    expect(r.ritmo).toBeCloseTo(60000 / 304000, 4);
  });

  it('sin presupuesto el ritmo es null', () => {
    expect(ritmoDelMes([], '2026-11-10').ritmo).toBeNull();
  });
});

describe('presupuestoVigente', () => {
  it('toma el último presupuesto de cada campaña activa', () => {
    const pausada = {
      ...campana('2026-11-10', 0, 5000),
      campana_id: '2',
      estado: 'PAUSED',
    };
    expect(
      presupuestoVigente(
        [
          campana('2026-11-08', 0, 8000),
          campana('2026-11-10', 0, 12000),
          pausada,
        ],
        '2026-11-10',
      ),
    ).toBe(12000);
  });
});
