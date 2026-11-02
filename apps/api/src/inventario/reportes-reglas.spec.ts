import {
  gastoDeCompras,
  insumosEnStockBajo,
  insumosEnStockNegativo,
  rangoDeMeses,
  valorizacionTotal,
} from './reportes-reglas';
import type { FilaInsumoReporte } from './reportes.tipos';

function insumo(
  id: string,
  stock: number,
  minimo: number,
  costo = 2,
): FilaInsumoReporte {
  return {
    id,
    nombre: id,
    unidad_medida: 'g',
    stock_actual_g: stock,
    stock_minimo_g: minimo,
    costo_unitario_g: costo,
  };
}

const INSUMOS = [
  insumo('negativo', -50, 100),
  insumo('en-cero', 0, 100),
  insumo('en-minimo', 100, 100),
  insumo('sano', 500, 100),
];

describe('valorizacionTotal', () => {
  it('suma stock por costo unitario, incluido un stock negativo', () => {
    expect(valorizacionTotal(INSUMOS)).toBe((-50 + 0 + 100 + 500) * 2);
  });

  it('sin insumos vale cero', () => {
    expect(valorizacionTotal([])).toBe(0);
  });
});

describe('alertas de stock', () => {
  it('el stock negativo es solo lo que está bajo cero', () => {
    expect(insumosEnStockNegativo(INSUMOS).map((i) => i.id)).toEqual([
      'negativo',
    ]);
  });

  it('el stock bajo incluye cero y el mínimo exacto, pero no el negativo', () => {
    expect(insumosEnStockBajo(INSUMOS).map((i) => i.id)).toEqual([
      'en-cero',
      'en-minimo',
    ]);
  });

  it('la alerta no arrastra el costo unitario', () => {
    expect(insumosEnStockNegativo(INSUMOS)[0]).toEqual({
      id: 'negativo',
      nombre: 'negativo',
      unidad_medida: 'g',
      stock_actual_g: -50,
      stock_minimo_g: 100,
    });
  });
});

describe('gastoDeCompras', () => {
  it('suma subtotal y otros cargos de cada compra', () => {
    expect(
      gastoDeCompras([
        { subtotal: 1000, otros_cargos: 100 },
        { subtotal: 500, otros_cargos: 0 },
      ]),
    ).toBe(1600);
  });
});

describe('rangoDeMeses', () => {
  it.each([
    ['2026-10-31', '2026-10-01', '2026-09-01'],
    ['2026-01-05', '2026-01-01', '2025-12-01'],
    ['2026-12-31', '2026-12-01', '2026-11-01'],
  ])('%s → mes actual %s, anterior %s', (hoy, actual, anterior) => {
    expect(rangoDeMeses(hoy)).toEqual({
      inicioMesActual: actual,
      inicioMesAnterior: anterior,
    });
  });
});
