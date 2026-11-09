import {
  CANTIDADES_SOCIAL,
  leerCantidad,
  listaDePrecios,
  sumarItem,
} from './opciones-social';

describe('opciones-social', () => {
  it('ofrece los botones de cantidad del 1 al 4', () => {
    expect(CANTIDADES_SOCIAL).toEqual([1, 2, 3, 4]);
  });

  it('sumarItem agrega una variante nueva y acumula la que ya estaba hasta 20', () => {
    const base = [{ varianteId: 'a', cantidad: 18 }];
    expect(sumarItem(base, 'b', 1)).toEqual([
      { varianteId: 'a', cantidad: 18 },
      { varianteId: 'b', cantidad: 1 },
    ]);
    expect(sumarItem(base, 'a', 1)).toEqual([
      { varianteId: 'a', cantidad: 19 },
    ]);
    expect(sumarItem(base, 'a', 4)).toEqual([
      { varianteId: 'a', cantidad: 20 },
    ]);
    // No muta el carrito original.
    expect(base).toEqual([{ varianteId: 'a', cantidad: 18 }]);
  });

  it('leerCantidad acepta ids de variante con guiones y rechaza lo inválido', () => {
    expect(leerCantidad('0b1c-22:3')).toEqual({
      varianteId: '0b1c-22',
      cantidad: 3,
    });
    expect(leerCantidad('abc:0')).toBeNull();
    expect(leerCantidad('abc:21')).toBeNull();
    expect(leerCantidad('abc:dos')).toBeNull();
    expect(leerCantidad('sin-cantidad')).toBeNull();
    expect(leerCantidad(':2')).toBeNull();
  });

  it('la lista de precios omite los adicionales y usa el precio de oferta si hay', () => {
    const texto = listaDePrecios([
      {
        id: 'p1',
        nombre: 'Pizza Margarita',
        descripcion: null,
        imagen_url: null,
        destacado: false,
        categoria_id: 'c',
        slug: null,
        ventas_historicas: null,
        variantes: [
          { id: 'v1', nombre: 'Personal', precio: 12000, precio_oferta: 10000 },
        ],
      },
      {
        id: 'p2',
        nombre: 'Adicional: Piña',
        descripcion: null,
        imagen_url: null,
        destacado: false,
        categoria_id: 'c',
        slug: null,
        ventas_historicas: null,
        variantes: [
          { id: 'v2', nombre: 'Personal', precio: 5000, precio_oferta: null },
        ],
      },
    ]);
    expect(texto).toContain('• Pizza Margarita: Personal $10.000');
    expect(texto).not.toContain('Adicional');
  });
});
