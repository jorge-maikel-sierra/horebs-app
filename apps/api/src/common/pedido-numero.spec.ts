import { idCortoPedido } from './pedido-numero';

describe('idCortoPedido', () => {
  it('toma los primeros 8 caracteres del uuid', () => {
    expect(idCortoPedido('1a2b3c4d-0000-4000-8000-000000000000')).toBe(
      '1a2b3c4d',
    );
  });

  it('un id más corto queda igual', () => {
    expect(idCortoPedido('abc')).toBe('abc');
  });
});
