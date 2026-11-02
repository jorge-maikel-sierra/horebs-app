import {
  comoSalida,
  explotarRecetas,
  paramsMovimientosPedido,
} from './inventario-reglas';
import type {
  FilaComponenteReceta,
  FilaRecetaExplosion,
} from './inventario.tipos';

function insumo(insumoId: string, gramos: number): FilaComponenteReceta {
  return {
    tipo_componente: 'insumo',
    insumo_id: insumoId,
    subreceta_id: null,
    cantidad_necesaria_g: gramos,
    subrecetas: null,
  };
}

function subreceta(
  gramos: number,
  rendimiento: number,
  componentes: { insumo_id: string; cantidad_necesaria_g: number }[] | null,
): FilaComponenteReceta {
  return {
    tipo_componente: 'subreceta',
    insumo_id: null,
    subreceta_id: 's-1',
    cantidad_necesaria_g: gramos,
    subrecetas: {
      rendimiento_g: rendimiento,
      subreceta_componentes: componentes,
    },
  };
}

function receta(
  varianteId: string,
  componentes: FilaComponenteReceta[] | null,
): FilaRecetaExplosion {
  return { variante_id: varianteId, receta_componentes: componentes };
}

describe('explotarRecetas', () => {
  it('multiplica cada insumo de la receta por la cantidad vendida', () => {
    const recetas = [
      receta('v-1', [insumo('harina', 200), insumo('queso', 80)]),
    ];

    expect(
      explotarRecetas([{ variante_id: 'v-1', cantidad: 3 }], recetas),
    ).toEqual([
      { insumo_id: 'harina', cantidad_g: 600 },
      { insumo_id: 'queso', cantidad_g: 240 },
    ]);
  });

  it('una subreceta se escala por gramos pedidos sobre rendimiento', () => {
    const salsa = subreceta(100, 1000, [
      { insumo_id: 'tomate', cantidad_necesaria_g: 800 },
      { insumo_id: 'sal', cantidad_necesaria_g: 20 },
    ]);

    const movimientos = explotarRecetas(
      [{ variante_id: 'v-1', cantidad: 2 }],
      [receta('v-1', [salsa])],
    );

    expect(movimientos).toEqual([
      { insumo_id: 'tomate', cantidad_g: 160 },
      { insumo_id: 'sal', cantidad_g: 4 },
    ]);
  });

  it('una subreceta sin rendimiento no se puede escalar y se omite', () => {
    const recetas = [
      receta('v-1', [
        subreceta(100, 0, [{ insumo_id: 'sal', cantidad_necesaria_g: 5 }]),
      ]),
    ];

    expect(
      explotarRecetas([{ variante_id: 'v-1', cantidad: 1 }], recetas),
    ).toEqual([]);
  });

  it('una subreceta sin componentes aporta nada', () => {
    const recetas = [receta('v-1', [subreceta(100, 1000, null)])];

    expect(
      explotarRecetas([{ variante_id: 'v-1', cantidad: 1 }], recetas),
    ).toEqual([]);
  });

  it('suma el mismo insumo que llega por receta directa, subreceta y otra variante', () => {
    const recetas = [
      receta('v-1', [
        insumo('sal', 10),
        subreceta(100, 1000, [{ insumo_id: 'sal', cantidad_necesaria_g: 50 }]),
      ]),
      receta('v-2', [insumo('sal', 1)]),
    ];

    const movimientos = explotarRecetas(
      [
        { variante_id: 'v-1', cantidad: 1 },
        { variante_id: 'v-2', cantidad: 4 },
      ],
      recetas,
    );

    expect(movimientos).toEqual([{ insumo_id: 'sal', cantidad_g: 19 }]);
  });

  it.each([
    ['sin receta activa', []],
    ['con receta sin componentes', [receta('v-1', null)]],
  ])('una variante %s se omite en silencio', (_caso, recetas) => {
    expect(
      explotarRecetas([{ variante_id: 'v-1', cantidad: 5 }], recetas),
    ).toEqual([]);
  });
});

describe('comoSalida y paramsMovimientosPedido', () => {
  it('comoSalida invierte el signo sin tocar el original', () => {
    const original = [{ insumo_id: 'harina', cantidad_g: 600 }];

    expect(comoSalida(original)).toEqual([
      { insumo_id: 'harina', cantidad_g: -600 },
    ]);
    expect(original[0].cantidad_g).toBe(600);
  });

  it('paramsMovimientosPedido arma los argumentos de la RPC del ledger', () => {
    const movimientos = [{ insumo_id: 'harina', cantidad_g: -600 }];

    expect(paramsMovimientosPedido(movimientos, 'p-1', 'venta', null)).toEqual({
      p_movimientos: movimientos,
      p_referencia_tipo: 'pedido',
      p_referencia_id: 'p-1',
      p_tipo: 'venta',
      p_created_by: null,
    });
  });
});
