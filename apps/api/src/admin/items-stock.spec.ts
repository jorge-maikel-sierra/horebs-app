import { itemsConVariante } from './items-stock';

describe('itemsConVariante', () => {
  it('deja solo las líneas con variante del catálogo', () => {
    expect(
      itemsConVariante([
        { variante_id: 'v1', cantidad: 2 },
        { variante_id: null, cantidad: 5 },
        { variante_id: 'v2', cantidad: 1 },
      ]),
    ).toEqual([
      { variante_id: 'v1', cantidad: 2 },
      { variante_id: 'v2', cantidad: 1 },
    ]);
  });

  it('descarta campos que no son del movimiento de stock', () => {
    const [linea] = itemsConVariante([
      { variante_id: 'v1', cantidad: 3, precio_unitario: 9000 } as {
        variante_id: string;
        cantidad: number;
      },
    ]);
    expect(Object.keys(linea)).toEqual(['variante_id', 'cantidad']);
  });

  it('sin líneas devuelve una lista vacía', () => {
    expect(itemsConVariante([])).toEqual([]);
  });
});
