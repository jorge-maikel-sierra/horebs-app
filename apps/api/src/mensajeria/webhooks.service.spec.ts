import { carritoDesdeOrden, textoCarritoCatalogo } from './webhooks.service';

const HAWAIANA_GRANDE = {
  varianteId: 'var-1',
  productoNombre: 'Pizza Hawaiana',
  varianteNombre: 'Grande',
  conTamanos: true,
  cantidad: 2,
  precio: 42000,
};

describe('carritoDesdeOrden', () => {
  it('toma el id de la variante y la cantidad, y nunca el precio', () => {
    const carrito = carritoDesdeOrden({
      catalog_id: 'cat-1',
      product_items: [
        {
          product_retailer_id: 'var-1',
          quantity: 2,
          item_price: 1,
          currency: 'COP',
        } as never,
      ],
    });
    expect(carrito).toEqual({
      items: [{ varianteId: 'var-1', cantidad: 2 }],
      nota: null,
    });
  });

  it('acota la cantidad entre 1 y 20', () => {
    const { items } = carritoDesdeOrden({
      product_items: [
        { product_retailer_id: 'a', quantity: 500 },
        { product_retailer_id: 'b', quantity: 0 },
        { product_retailer_id: 'c', quantity: -3 },
      ],
    });
    expect(items.map((i) => i.cantidad)).toEqual([20, 1, 1]);
  });

  it('descarta ítems sin id y conserva la nota del cliente', () => {
    const carrito = carritoDesdeOrden({
      text: '  sin cebolla  ',
      product_items: [{ quantity: 1 }, { product_retailer_id: 'a' }],
    });
    expect(carrito.items).toEqual([{ varianteId: 'a', cantidad: 1 }]);
    expect(carrito.nota).toBe('sin cebolla');
  });
});

describe('textoCarritoCatalogo', () => {
  it('arma el pedido con tamaño solo cuando el producto tiene tamaños', () => {
    const texto = textoCarritoCatalogo(
      [
        HAWAIANA_GRANDE,
        {
          varianteId: 'var-2',
          productoNombre: 'Coca-Cola',
          varianteNombre: 'Única',
          conTamanos: false,
          cantidad: 1,
          precio: 4000,
        },
      ],
      0,
      null,
    );
    expect(texto).toBe(
      'Envié mi carrito del catálogo: 2x Pizza Hawaiana (Grande), 1x Coca-Cola.',
    );
  });

  it('avisa cuántos productos ya no están disponibles y agrega la nota', () => {
    const texto = textoCarritoCatalogo([HAWAIANA_GRANDE], 1, 'sin cebolla');
    expect(texto).toContain(
      '(1 producto(s) del carrito ya no están disponibles.)',
    );
    expect(texto).toContain('Nota: sin cebolla');
  });

  it('si nada está disponible lo dice sin inventar productos', () => {
    expect(textoCarritoCatalogo([], 2, null)).toContain(
      'ninguno de esos productos está disponible',
    );
  });
});
