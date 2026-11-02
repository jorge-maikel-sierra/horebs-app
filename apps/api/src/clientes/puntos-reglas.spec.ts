import { BadRequestException } from '@nestjs/common';
import {
  canjeMaximo,
  configuracionDeFilas,
  DEFECTOS,
  errorDeAjuste,
  filasDeConfiguracion,
  limiteDeVencimiento,
  paramsMovimientoPuntos,
  puntosPorMonto,
  validarAjustePuntos,
} from './puntos-reglas';
import type { ConfiguracionPuntos } from './puntos.tipos';

const CONFIG: ConfiguracionPuntos = {
  puntosPor1000Pesos: 1,
  valorPuntoPesos: 50,
  puntosMinimoCanje: 100,
  puntosVencimientoMeses: 12,
};

describe('puntosPorMonto', () => {
  it.each([
    [999, 0],
    [1000, 1],
    [25_900, 25],
  ])('$%s gana %s puntos', (monto, puntos) => {
    expect(puntosPorMonto(monto, CONFIG)).toBe(puntos);
  });

  it('respeta cuántos puntos da cada mil pesos', () => {
    expect(puntosPorMonto(5000, { puntosPor1000Pesos: 2 })).toBe(10);
  });
});

describe('configuracionDeFilas', () => {
  it('sin filas devuelve los defectos', () => {
    expect(configuracionDeFilas([])).toEqual(DEFECTOS);
  });

  it('lee cada clave y deja el defecto en lo que falta', () => {
    expect(
      configuracionDeFilas([
        { clave: 'valor_punto_pesos', valor: '80' },
        { clave: 'puntos_minimo_canje', valor: '0' },
      ]),
    ).toEqual({ ...DEFECTOS, valorPuntoPesos: 80, puntosMinimoCanje: 0 });
  });

  it.each(['abc', '-5'])('un valor "%s" cae al defecto', (valor) => {
    expect(
      configuracionDeFilas([{ clave: 'valor_punto_pesos', valor }])
        .valorPuntoPesos,
    ).toBe(DEFECTOS.valorPuntoPesos);
  });
});

describe('filasDeConfiguracion', () => {
  it('solo escribe lo que el cambio trae', () => {
    expect(filasDeConfiguracion({ valorPuntoPesos: 60 })).toEqual([
      { clave: 'valor_punto_pesos', valor: '60' },
    ]);
  });

  it('un cambio vacío no escribe nada', () => {
    expect(filasDeConfiguracion({})).toEqual([]);
  });

  it('un valor en cero es válido', () => {
    expect(filasDeConfiguracion({ puntosMinimoCanje: 0 })).toEqual([
      { clave: 'puntos_minimo_canje', valor: '0' },
    ]);
  });

  it('un valor negativo es 400', () => {
    expect(() => filasDeConfiguracion({ puntosPor1000Pesos: -1 })).toThrow(
      BadRequestException,
    );
  });
});

describe('canjeMaximo', () => {
  it('por debajo del mínimo de canje no se puede usar ningún punto', () => {
    expect(canjeMaximo(99, 100_000, CONFIG)).toEqual({
      puntos: 0,
      descuento: 0,
    });
  });

  it('con saldo de sobra se limita por el monto del pedido', () => {
    expect(canjeMaximo(1000, 10_000, CONFIG)).toEqual({
      puntos: 200,
      descuento: 10_000,
    });
  });

  it('con poco monto no se descuenta más de lo que cabe', () => {
    expect(canjeMaximo(1000, 10_025, CONFIG)).toEqual({
      puntos: 200,
      descuento: 10_000,
    });
  });

  it('con poco saldo se limita por el saldo', () => {
    expect(canjeMaximo(120, 100_000, CONFIG)).toEqual({
      puntos: 120,
      descuento: 6000,
    });
  });
});

describe('validarAjustePuntos', () => {
  it('un ajuste con puntos y motivo es válido', () => {
    expect(() =>
      validarAjustePuntos({ puntos: -10, motivo: 'corrección' }),
    ).not.toThrow();
  });

  it.each([
    ['puntos en cero', { puntos: 0, motivo: 'x' }],
    ['puntos no finitos', { puntos: NaN, motivo: 'x' }],
    ['motivo en blanco', { puntos: 5, motivo: '  ' }],
  ])('%s es 400', (_caso, ajuste) => {
    expect(() => validarAjustePuntos(ajuste)).toThrow(BadRequestException);
  });
});

describe('errorDeAjuste', () => {
  it('un cliente que no existe es 404', () => {
    expect(errorDeAjuste('cliente no existe')?.getStatus()).toBe(404);
  });

  it('un saldo que quedaría negativo es un conflicto 409', () => {
    expect(errorDeAjuste('saldo negativo')?.getStatus()).toBe(409);
  });

  it('cualquier otro error no se traduce', () => {
    expect(errorDeAjuste('timeout')).toBeNull();
    expect(errorDeAjuste(undefined)).toBeNull();
  });
});

describe('paramsMovimientoPuntos', () => {
  it('arma los argumentos de la RPC del ledger', () => {
    expect(
      paramsMovimientoPuntos({
        clienteId: 'c-1',
        tipo: 'ganado',
        puntos: 6,
        referenciaTipo: 'pedido',
        referenciaId: 'p-1',
        motivo: null,
        creadoPor: null,
        actualizarActividad: true,
      }),
    ).toEqual({
      p_cliente_id: 'c-1',
      p_tipo: 'ganado',
      p_puntos: 6,
      p_referencia_tipo: 'pedido',
      p_referencia_id: 'p-1',
      p_motivo: null,
      p_created_by: null,
      p_actualizar_actividad: true,
    });
  });
});

describe('limiteDeVencimiento', () => {
  it('resta los meses sin modificar la fecha original', () => {
    const ahora = new Date('2026-10-30T12:00:00Z');

    expect(limiteDeVencimiento(ahora, 12).toISOString()).toBe(
      '2025-10-30T12:00:00.000Z',
    );
    expect(ahora.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });
});
