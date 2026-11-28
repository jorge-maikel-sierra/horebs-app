import { productoIncluyeDomicilio } from './costos';

describe('productoIncluyeDomicilio', () => {
  it('el Combo Personal trae el domicilio incluido', () => {
    expect(productoIncluyeDomicilio('combo-personal')).toBe(true);
  });

  it.each([['pizza-jamon-y-queso'], [null], [undefined]])(
    '%s no lo trae',
    (slug) => {
      expect(productoIncluyeDomicilio(slug)).toBe(false);
    },
  );
});
