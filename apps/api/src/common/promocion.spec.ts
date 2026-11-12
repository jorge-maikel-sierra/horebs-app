import {
  cotizacionVigente,
  descuentoSobrePizzas,
  elegirPromocion,
  ofertaSeguimientoVigente,
  promocionDePedido,
  diaSemanaBogota,
  esPizza,
  promocionActiva,
  textoDescuentoAplicado,
} from './promocion';

// Noviembre de 2026: miércoles 4, jueves 5, viernes 6. Bogotá es UTC-5.
const bogota = (dia: number, hora: string): Date =>
  new Date(`2026-11-${String(dia).padStart(2, '0')}T${hora}:00-05:00`);

describe('promocionActiva', () => {
  it('es solo de miércoles y jueves, hasta las 8:00 p.m. de Bogotá', () => {
    expect(promocionActiva(bogota(4, '10:00'))).toBe(true);
    expect(promocionActiva(bogota(4, '19:59'))).toBe(true);
    expect(promocionActiva(bogota(4, '20:00'))).toBe(false);
    expect(promocionActiva(bogota(5, '16:30'))).toBe(true);
    expect(promocionActiva(bogota(5, '21:00'))).toBe(false);
    expect(promocionActiva(bogota(6, '12:00'))).toBe(false);
    expect(promocionActiva(bogota(3, '12:00'))).toBe(false);
  });

  it('usa el día de Bogotá y no el de UTC', () => {
    // Miércoles 8:30 p.m. en Bogotá = jueves 1:30 a.m. UTC: ya no aplica.
    const nocheDeMiercoles = new Date('2026-11-05T01:30:00Z');
    expect(diaSemanaBogota(nocheDeMiercoles)).toBe(3);
    expect(promocionActiva(nocheDeMiercoles)).toBe(false);
    // Jueves 12:30 a.m. en Bogotá = jueves 5:30 a.m. UTC: sí aplica.
    expect(promocionActiva(new Date('2026-11-05T05:30:00Z'))).toBe(true);
  });
});

describe('descuentoSobrePizzas', () => {
  const pizza = (subtotal: number, tamano = 'Mediana') => ({
    producto_nombre: 'Pizza Hawaiana',
    variante_nombre: tamano,
    subtotal,
  });

  it('es el 20% del valor de las pizzas', () => {
    expect(descuentoSobrePizzas([pizza(35000)])).toBe(7000);
    expect(descuentoSobrePizzas([pizza(35000), pizza(45000, 'Grande')])).toBe(
      16000,
    );
  });

  it('no toca bebidas, panzerotti ni adicionales', () => {
    const lineas = [
      pizza(35000),
      { producto_nombre: 'Panzerotti', variante_nombre: null, subtotal: 12000 },
      {
        producto_nombre: 'Coca-Cola',
        variante_nombre: '400ml',
        subtotal: 4000,
      },
      {
        producto_nombre: 'Adicional: Piña',
        variante_nombre: 'Mediana',
        subtotal: 9000,
      },
    ];
    expect(descuentoSobrePizzas(lineas)).toBe(7000);
  });

  it('sin pizzas no hay descuento, y se redondea al peso', () => {
    expect(descuentoSobrePizzas([])).toBe(0);
    expect(
      descuentoSobrePizzas([
        {
          producto_nombre: 'Panzerotti',
          variante_nombre: null,
          subtotal: 12000,
        },
      ]),
    ).toBe(0);
    expect(descuentoSobrePizzas([pizza(16333)])).toBe(3267);
  });
});

describe('esPizza', () => {
  it('reconoce los tamaños con o sin mayúsculas y tildes', () => {
    expect(esPizza('Pizza Ranchera', 'Personal')).toBe(true);
    expect(esPizza('Pizza Ranchera', 'GRANDE')).toBe(true);
    expect(esPizza('Pizza Ranchera', null)).toBe(false);
    expect(esPizza('Adicional: Jamón', 'Personal')).toBe(false);
    expect(esPizza('Jugo', 'Único')).toBe(false);
  });
});

describe('cotizacionVigente', () => {
  it('vale hasta dos horas después de mostrarle el precio al cliente', () => {
    const cotizada = bogota(4, '19:00').toISOString();
    expect(cotizacionVigente(cotizada, bogota(4, '19:30'))).toBe(true);
    expect(cotizacionVigente(cotizada, bogota(4, '21:00'))).toBe(true);
    expect(cotizacionVigente(cotizada, bogota(4, '21:01'))).toBe(false);
    expect(cotizacionVigente(cotizada, bogota(5, '10:00'))).toBe(false);
  });

  it('sin cotización, o con una fecha futura, no vale', () => {
    expect(cotizacionVigente(undefined, bogota(4, '19:00'))).toBe(false);
    expect(
      cotizacionVigente(bogota(4, '20:00').toISOString(), bogota(4, '19:00')),
    ).toBe(false);
  });
});

describe('textoDescuentoAplicado', () => {
  it('deja a la vista cuánto se descontó', () => {
    expect(textoDescuentoAplicado(7000)).toBe(
      'Descuento 20% en pizzas: -$7.000',
    );
  });
});

describe('oferta de seguimiento (10% en pizzas personales)', () => {
  const LINEAS = [
    {
      producto_nombre: 'Pizza Hawaiana',
      variante_nombre: 'Personal',
      subtotal: 20000,
    },
    {
      producto_nombre: 'Pizza Hawaiana',
      variante_nombre: 'Grande',
      subtotal: 50000,
    },
    {
      producto_nombre: 'Adicional: Jamón',
      variante_nombre: 'Personal',
      subtotal: 5000,
    },
    { producto_nombre: 'Gaseosa', variante_nombre: null, subtotal: 4000 },
  ];

  it('descuenta el 10% solo de las pizzas personales', () => {
    expect(descuentoSobrePizzas(LINEAS, 'seguimiento')).toBe(2000);
  });

  it('el 20% del día sigue tocando todas las pizzas', () => {
    expect(descuentoSobrePizzas(LINEAS, 'dia')).toBe(14000);
  });

  it('el pedido con oferta anota el descuento para el equipo', () => {
    const { descuento, notas } = promocionDePedido(
      'seguimiento',
      LINEAS,
      'sin cebolla',
    );
    expect(descuento).toBe(2000);
    expect(notas).toBe(
      'sin cebolla | Oferta 10% en pizzas personales: -$2.000',
    );
  });

  it('sin promoción no hay descuento', () => {
    expect(promocionDePedido(undefined, LINEAS, undefined)).toEqual({
      descuento: 0,
      notas: undefined,
    });
  });

  it('la oferta vale 24 horas desde que se mandó', () => {
    const enviada = '2026-11-12T20:00:00.000Z';
    expect(
      ofertaSeguimientoVigente(enviada, new Date('2026-11-13T19:59:00Z')),
    ).toBe(true);
    expect(
      ofertaSeguimientoVigente(enviada, new Date('2026-11-13T20:01:00Z')),
    ).toBe(false);
    expect(ofertaSeguimientoVigente(null, new Date())).toBe(false);
  });

  it('si aplican las dos, gana el 20% del día (no se acumulan)', () => {
    expect(elegirPromocion(true, true)).toBe('dia');
    expect(elegirPromocion(false, true)).toBe('seguimiento');
    expect(elegirPromocion(false, false)).toBeUndefined();
  });
});
