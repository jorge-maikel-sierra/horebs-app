import { normalizarTelefonoCO } from './normalizar-telefono';

describe('normalizarTelefonoCO', () => {
  it('quita el 57 que agrega Meta', () => {
    expect(normalizarTelefonoCO('573157861208')).toBe('3157861208');
  });

  it('deja igual un número local', () => {
    expect(normalizarTelefonoCO('3157861208')).toBe('3157861208');
  });

  it('ignora símbolos y espacios', () => {
    expect(normalizarTelefonoCO('+57 315 786 1208')).toBe('3157861208');
  });

  it('no recorta un 57 de un número que no tiene código de país', () => {
    expect(normalizarTelefonoCO('5712345')).toBe('5712345');
  });

  it('un texto sin dígitos queda vacío', () => {
    expect(normalizarTelefonoCO('abc')).toBe('');
  });
});
