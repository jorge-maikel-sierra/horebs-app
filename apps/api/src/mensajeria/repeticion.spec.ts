import { esRepeticion, type UltimoMensaje } from './repeticion';

describe('esRepeticion', () => {
  it('el mismo texto del mismo cliente en menos de 10 s es repetición', () => {
    const ultimos = new Map<string, UltimoMensaje>();
    expect(esRepeticion(ultimos, 'c1', '¿Precio?', 0)).toBe(false);
    expect(esRepeticion(ultimos, 'c1', ' ¿precio? ', 5_000)).toBe(true);
  });

  it('pasados 10 s, otro texto u otro cliente no es repetición', () => {
    const ultimos = new Map<string, UltimoMensaje>();
    esRepeticion(ultimos, 'c1', 'hola', 0);
    expect(esRepeticion(ultimos, 'c1', 'hola', 10_000)).toBe(false);
    expect(esRepeticion(ultimos, 'c1', 'menú', 11_000)).toBe(false);
    expect(esRepeticion(ultimos, 'c2', 'menú', 11_500)).toBe(false);
  });

  it('un mensaje sin texto nunca es repetición', () => {
    const ultimos = new Map<string, UltimoMensaje>();
    esRepeticion(ultimos, 'c1', '', 0);
    expect(esRepeticion(ultimos, 'c1', '', 1)).toBe(false);
  });
});
