import { estadoVencimiento } from './turno-reglas';

describe('estadoVencimiento', () => {
  it('un turno abierto hoy no está vencido', () => {
    const ahora = new Date('2026-08-14T01:00:00Z'); // 13 ago 8:00 p. m. Bogotá
    expect(estadoVencimiento('2026-08-14T00:30:00Z', ahora)).toEqual({
      vencido: false,
      dias_abierto: 0,
    });
  });

  it('cruzar la medianoche UTC no vence el turno de la misma noche', () => {
    // Abierto 10:21 p. m. del 13 ago (03:21 UTC del 14), ahora 10:50 p. m.
    const ahora = new Date('2026-08-14T03:50:00Z');
    expect(estadoVencimiento('2026-08-14T03:21:30Z', ahora).vencido).toBe(
      false,
    );
  });

  it('un turno del día anterior está vencido (1 día)', () => {
    const ahora = new Date('2026-08-14T22:00:00Z'); // 14 ago 5:00 p. m.
    expect(estadoVencimiento('2026-08-14T03:21:30Z', ahora)).toEqual({
      vencido: true,
      dias_abierto: 1,
    });
  });

  it('cuenta los días de un turno olvidado', () => {
    const ahora = new Date('2026-11-02T20:00:00Z');
    expect(estadoVencimiento('2026-08-14T03:21:30Z', ahora)).toEqual({
      vencido: true,
      dias_abierto: 81,
    });
  });
});
