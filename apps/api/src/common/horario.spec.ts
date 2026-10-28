import {
  estadoAtencion,
  etiquetaHora,
  franjaVigente,
  finDiaBogota,
  franjasEntrega,
  inicioDiaBogota,
} from './horario';

/** Hora de Bogotá → Date (Colombia es UTC-5 todo el año). */
const bogota = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00-05:00`);

describe('estadoAtencion', () => {
  it.each([
    ['10:59', 'cerrado'],
    ['11:00', 'reservas'],
    ['15:59', 'reservas'],
    ['16:00', 'abierto'],
    ['22:59', 'abierto'],
    ['23:00', 'cerrado'],
    ['02:00', 'cerrado'],
  ])('%s → %s', (hora, esperado) => {
    expect(estadoAtencion(bogota(hora))).toBe(esperado);
  });
});

describe('franjasEntrega', () => {
  it('cerrado: no se ofrece nada', () => {
    expect(franjasEntrega(bogota('08:00'))).toEqual([]);
  });

  it('en reservas arranca a las 4:00 p.m., sin "lo antes posible"', () => {
    const franjas = franjasEntrega(bogota('11:30'));
    expect(franjas[0]).toEqual({
      id: '16:00',
      titulo: '4:00 p.m.',
      programadoPara: '2026-10-28T16:00:00-05:00',
    });
    expect(franjas.some((f) => f.id === 'ya')).toBe(false);
    expect(franjas).toHaveLength(10);
  });

  it('abierto: "lo antes posible" primero y después ahora + 45 min', () => {
    const franjas = franjasEntrega(bogota('18:20'));
    expect(franjas[0].id).toBe('ya');
    expect(franjas[1]).toMatchObject({ id: '19:30', titulo: '7:30 p.m.' });
  });

  it('nunca pasa de las 10:30 p.m.', () => {
    const franjas = franjasEntrega(bogota('21:30'));
    expect(franjas.map((f) => f.id)).toEqual(['ya', '22:30']);
  });

  it('a las 10:50 p.m. solo queda "lo antes posible"', () => {
    expect(franjasEntrega(bogota('22:50')).map((f) => f.id)).toEqual(['ya']);
  });
});

describe('franjaVigente y etiquetaHora', () => {
  it('una franja vence si ya no está en la lista', () => {
    expect(franjaVigente('16:00', bogota('12:00'))).not.toBeNull();
    expect(franjaVigente('16:00', bogota('15:30'))).toBeNull();
  });

  it('formatea en 12 horas', () => {
    expect(etiquetaHora('2026-10-28T18:30:00-05:00')).toBe('6:30 p.m.');
  });
});

describe('inicioDiaBogota y finDiaBogota', () => {
  it('acotan el día en hora de Bogotá, no en UTC', () => {
    expect(inicioDiaBogota('2026-10-27')).toBe('2026-10-27T00:00:00.000-05:00');
    expect(finDiaBogota('2026-10-27')).toBe('2026-10-27T23:59:59.999-05:00');
    // Una venta a las 9 p.m. de Bogotá (02:00 UTC del 28) cae dentro del 27.
    const venta = new Date('2026-10-28T02:00:00Z').getTime();
    expect(venta).toBeGreaterThanOrEqual(
      new Date(inicioDiaBogota('2026-10-27')).getTime(),
    );
    expect(venta).toBeLessThanOrEqual(
      new Date(finDiaBogota('2026-10-27')).getTime(),
    );
  });
});
