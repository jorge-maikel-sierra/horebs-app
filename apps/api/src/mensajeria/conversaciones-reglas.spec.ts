import {
  avanzarVentanaLimite,
  CLAVE_OFERTA_MINUTOS,
  CLAVE_RECORDATORIO_MINUTOS,
  configuracionDeFilas,
  haceMinutos,
} from './conversaciones-reglas';

const AHORA = new Date('2026-10-31T20:00:00.000Z');

describe('haceMinutos', () => {
  it('resta los minutos al instante dado', () => {
    expect(haceMinutos(180, AHORA)).toBe('2026-10-31T17:00:00.000Z');
  });
});

describe('configuracionDeFilas', () => {
  it('lee los plazos de las filas de configuracion', () => {
    expect(
      configuracionDeFilas([
        { clave: CLAVE_RECORDATORIO_MINUTOS, valor: '90' },
        { clave: CLAVE_OFERTA_MINUTOS, valor: '240' },
      ]),
    ).toEqual({ recordatorioMinutos: 90, ofertaMinutos: 240 });
  });

  it('sin filas usa los plazos por defecto (3 y 6 horas)', () => {
    expect(configuracionDeFilas([])).toEqual({
      recordatorioMinutos: 180,
      ofertaMinutos: 360,
    });
  });

  it.each(['abc', '0', '-5', ''])(
    'un valor inválido (%j) cae al defecto',
    (valor) => {
      expect(
        configuracionDeFilas([
          { clave: CLAVE_RECORDATORIO_MINUTOS, valor },
          { clave: CLAVE_OFERTA_MINUTOS, valor },
        ]),
      ).toEqual({ recordatorioMinutos: 180, ofertaMinutos: 360 });
    },
  );
});

describe('avanzarVentanaLimite', () => {
  it('sin ventana previa arranca una nueva con el contador en 1', () => {
    expect(
      avanzarVentanaLimite({ inicio: null, contador: null }, AHORA, 10),
    ).toEqual({ inicio: AHORA.toISOString(), contador: 1 });
  });

  it('dentro de la ventana suma y conserva el inicio', () => {
    const inicio = '2026-10-31T19:55:00.000Z';
    expect(avanzarVentanaLimite({ inicio, contador: 4 }, AHORA, 10)).toEqual({
      inicio,
      contador: 5,
    });
  });

  it('vencida la ventana, reinicia el contador', () => {
    expect(
      avanzarVentanaLimite(
        { inicio: '2026-10-31T19:30:00.000Z', contador: 9 },
        AHORA,
        10,
      ),
    ).toEqual({ inicio: AHORA.toISOString(), contador: 1 });
  });
});
