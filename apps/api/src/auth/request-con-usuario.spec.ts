import { tokenBearer } from './request-con-usuario';

describe('tokenBearer', () => {
  it('devuelve el token de un header Bearer', () => {
    expect(tokenBearer('Bearer abc.def')).toBe('abc.def');
  });

  it('sin header o con otro esquema no hay token', () => {
    expect(tokenBearer(undefined)).toBeUndefined();
    expect(tokenBearer('Basic abc')).toBeUndefined();
    expect(tokenBearer('bearer abc')).toBeUndefined();
  });
});
