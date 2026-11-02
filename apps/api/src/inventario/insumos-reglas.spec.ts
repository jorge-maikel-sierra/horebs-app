import { BadRequestException } from '@nestjs/common';
import {
  alertasPorEnviar,
  cambiosDeInsumo,
  cantidadFirmada,
  COOLDOWN_ALERTA_MS,
  filaNuevoInsumo,
  filtrarStockBajo,
  paramsAjusteStock,
  validarAjuste,
  validarCrearInsumo,
  validarEdicionInsumo,
} from './insumos-reglas';
import type {
  CrearInsumoInput,
  FilaStockInsumo,
  InsumoDto,
} from './insumos.tipos';

const AHORA = Date.parse('2026-10-30T12:00:00Z');

const NUEVO: CrearInsumoInput = { nombre: ' Harina ', categoria: ' Secos ' };

function fila(cambios: Partial<FilaStockInsumo> = {}): FilaStockInsumo {
  return {
    id: 'i-1',
    nombre: 'Harina',
    unidad_medida: 'g',
    stock_actual_g: 100,
    stock_minimo_g: 500,
    alerta_stock_enviada_en: null,
    ...cambios,
  };
}

describe('validarCrearInsumo', () => {
  it('un insumo con nombre y categoría es válido', () => {
    expect(() => validarCrearInsumo(NUEVO)).not.toThrow();
  });

  it.each([
    ['sin nombre', { nombre: '  ' }],
    ['sin categoría', { categoria: '' }],
    ['con unidad inventada', { unidad_medida: 'litro' as never }],
    ['con stock mínimo negativo', { stock_minimo_g: -1 }],
  ])('%s es 400', (_caso, cambios) => {
    expect(() => validarCrearInsumo({ ...NUEVO, ...cambios })).toThrow(
      BadRequestException,
    );
  });
});

describe('filaNuevoInsumo', () => {
  it('recorta textos y aplica los valores por defecto', () => {
    expect(filaNuevoInsumo(NUEVO)).toEqual({
      nombre: 'Harina',
      categoria: 'Secos',
      unidad_medida: 'g',
      stock_minimo_g: 0,
      proveedor_principal: null,
    });
  });

  it('un proveedor en blanco queda null', () => {
    expect(
      filaNuevoInsumo({ ...NUEVO, proveedor_principal: '   ' })
        .proveedor_principal,
    ).toBeNull();
  });
});

describe('validarEdicionInsumo', () => {
  it('un cambio vacío es válido', () => {
    expect(() => validarEdicionInsumo({})).not.toThrow();
  });

  it.each([
    ['nombre vacío', { nombre: ' ' }],
    ['unidad inventada', { unidad_medida: 'litro' as never }],
    ['stock mínimo negativo', { stock_minimo_g: -5 }],
  ])('%s es 400', (_caso, cambios) => {
    expect(() => validarEdicionInsumo(cambios)).toThrow(BadRequestException);
  });
});

describe('cambiosDeInsumo', () => {
  it('solo incluye lo que el cambio trae', () => {
    expect(cambiosDeInsumo({ activo: false })).toEqual({ activo: false });
  });

  it('recorta textos y un proveedor en blanco se guarda como null', () => {
    expect(
      cambiosDeInsumo({
        nombre: ' Queso ',
        categoria: ' Lácteos ',
        unidad_medida: 'g',
        stock_minimo_g: 0,
        proveedor_principal: ' ',
      }),
    ).toEqual({
      nombre: 'Queso',
      categoria: 'Lácteos',
      unidad_medida: 'g',
      stock_minimo_g: 0,
      proveedor_principal: null,
    });
  });
});

describe('filtrarStockBajo', () => {
  it('deja los insumos en o por debajo del mínimo', () => {
    const base = { stock_minimo_g: 10 } as InsumoDto;
    const insumos = [
      { ...base, id: 'a', stock_actual_g: 5 },
      { ...base, id: 'b', stock_actual_g: 10 },
      { ...base, id: 'c', stock_actual_g: 11 },
    ];
    expect(filtrarStockBajo(insumos).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('ajustes de stock', () => {
  it.each([
    ['cantidad cero', { tipo: 'ajuste', cantidad_g: 0, motivo: 'conteo' }],
    [
      'cantidad no finita',
      { tipo: 'ajuste', cantidad_g: Infinity, motivo: 'conteo' },
    ],
    ['motivo en blanco', { tipo: 'merma', cantidad_g: 5, motivo: '  ' }],
  ] as const)('%s es 400', (_caso, ajuste) => {
    expect(() => validarAjuste(ajuste)).toThrow(BadRequestException);
  });

  it('una merma siempre resta, venga con el signo que venga', () => {
    expect(
      cantidadFirmada({ tipo: 'merma', cantidad_g: 30, motivo: 'x' }),
    ).toBe(-30);
    expect(
      cantidadFirmada({ tipo: 'merma', cantidad_g: -30, motivo: 'x' }),
    ).toBe(-30);
  });

  it('un ajuste conserva el signo', () => {
    expect(
      cantidadFirmada({ tipo: 'ajuste', cantidad_g: 30, motivo: 'x' }),
    ).toBe(30);
    expect(
      cantidadFirmada({ tipo: 'ajuste', cantidad_g: -30, motivo: 'x' }),
    ).toBe(-30);
  });

  it('paramsAjusteStock arma los argumentos de la RPC del ledger', () => {
    expect(
      paramsAjusteStock(
        'i-1',
        { tipo: 'merma', cantidad_g: 30, motivo: ' se cayó ' },
        'u-1',
      ),
    ).toEqual({
      p_movimientos: [{ insumo_id: 'i-1', cantidad_g: -30 }],
      p_referencia_tipo: 'ajuste_manual',
      p_referencia_id: null,
      p_tipo: 'merma',
      p_created_by: 'u-1',
      p_motivo: 'se cayó',
    });
  });
});

describe('alertasPorEnviar', () => {
  const haceMs = (ms: number): string => new Date(AHORA - ms).toISOString();

  it('un insumo bajo el mínimo y sin aviso previo se avisa', () => {
    expect(alertasPorEnviar([fila()], AHORA)).toEqual({
      paraAlertar: [
        {
          id: 'i-1',
          nombre: 'Harina',
          unidad: 'g',
          stockActual: 100,
          stockMinimo: 500,
        },
      ],
      paraResetear: [],
    });
  });

  it('dentro del cooldown no se vuelve a avisar', () => {
    const f = fila({ alerta_stock_enviada_en: haceMs(COOLDOWN_ALERTA_MS - 1) });
    expect(alertasPorEnviar([f], AHORA)).toEqual({
      paraAlertar: [],
      paraResetear: [],
    });
  });

  it('pasado el cooldown se avisa otra vez', () => {
    const f = fila({ alerta_stock_enviada_en: haceMs(COOLDOWN_ALERTA_MS + 1) });
    expect(alertasPorEnviar([f], AHORA).paraAlertar).toHaveLength(1);
  });

  it('un insumo recuperado con aviso registrado apaga la marca', () => {
    const f = fila({
      stock_actual_g: 900,
      alerta_stock_enviada_en: haceMs(1000),
    });
    expect(alertasPorEnviar([f], AHORA)).toEqual({
      paraAlertar: [],
      paraResetear: ['i-1'],
    });
  });

  it('un insumo sano sin aviso previo no hace nada', () => {
    expect(alertasPorEnviar([fila({ stock_actual_g: 900 })], AHORA)).toEqual({
      paraAlertar: [],
      paraResetear: [],
    });
  });
});
