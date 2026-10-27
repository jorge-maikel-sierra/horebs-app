import {
  dentroDeLaVentana,
  enVentanaDeRecompra,
  textoAvisoEstado,
  textoRecompra,
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

describe('textoRecompra', () => {
  const config = { valorPuntoPesos: 50, minimoCanje: 100 };

  it('con saldo canjeable muestra cuánta plata representa', () => {
    expect(textoRecompra({ ganados: 70, saldo: 410, ...config })).toContain(
      '⭐ Con esa compra sumaste 70 puntos y ya tenés 410: son *$20.500* para tu próxima compra.',
    );
  });

  it('bajo el mínimo dice desde cuánto se canjean', () => {
    expect(textoRecompra({ ganados: 40, saldo: 40, ...config })).toContain(
      'ya vas en 40. Desde 100 los podés cambiar por descuento.',
    );
  });

  it('sin puntos queda solo la invitación', () => {
    const texto = textoRecompra(null);
    expect(texto).not.toContain('⭐');
    expect(texto).toContain('repetilo con un toque');
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
