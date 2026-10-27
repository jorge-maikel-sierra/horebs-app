import {
  dentroDeLaVentana,
  enVentanaDeRecompra,
  textoAvisoEstado,
} from './avisos-pedido';

const HORA = 60 * 60 * 1000;
const PEDIDO = {
  id: 'abcd1234-0000-0000-0000-000000000000',
  modalidad: 'domicilio',
  direccionEntrega: 'Carrera 7H1 # 33 - 66',
};

describe('textoAvisoEstado', () => {
  it.each([
    ['confirmado', '✅ ¡Confirmamos tu pedido *#abcd1234*!'],
    ['en_preparacion', '🔥 Tu pedido *#abcd1234* ya está en el horno.'],
    ['en_camino', 'va en camino a Carrera 7H1 # 33 - 66.'],
    ['cancelado', 'fue cancelado'],
  ])('%s → texto fijo', (estado, esperado) => {
    expect(textoAvisoEstado({ ...PEDIDO, estado })).toContain(esperado);
  });

  it('entregado distingue domicilio de retiro', () => {
    expect(textoAvisoEstado({ ...PEDIDO, estado: 'entregado' })).toContain(
      'Gracias por pedirnos',
    );
    expect(
      textoAvisoEstado({ ...PEDIDO, modalidad: 'retiro', estado: 'entregado' }),
    ).toContain('está listo');
  });

  it('pendiente no avisa nada (ya recibió la confirmación)', () => {
    expect(textoAvisoEstado({ ...PEDIDO, estado: 'pendiente' })).toBeNull();
  });
});

describe('ventana de 24h', () => {
  const ahora = new Date('2026-10-28T20:00:00Z');
  const hace = (horas: number) => new Date(ahora.getTime() - horas * HORA);

  it('dentro de la ventana hasta las 24h', () => {
    expect(dentroDeLaVentana(hace(2), ahora)).toBe(true);
    expect(dentroDeLaVentana(hace(23.9), ahora)).toBe(true);
    expect(dentroDeLaVentana(hace(24), ahora)).toBe(false);
  });

  it('la recompra sale solo en la última hora', () => {
    expect(enVentanaDeRecompra(hace(22.9), ahora)).toBe(false);
    expect(enVentanaDeRecompra(hace(23), ahora)).toBe(true);
    expect(enVentanaDeRecompra(hace(23.8), ahora)).toBe(true);
    expect(enVentanaDeRecompra(hace(24), ahora)).toBe(false);
  });
});
