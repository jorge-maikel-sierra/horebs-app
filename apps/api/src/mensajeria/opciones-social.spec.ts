import {
  BOTONES_ARMAR_PEDIDO,
  BOTONES_INICIO,
  BOTONES_TRAS_PRECIO,
  CANTIDADES_SOCIAL,
  leerCantidad,
  botonesMasPedidas,
  sumarItem,
} from './opciones-social';

// Meta corta a 20 caracteres el título de un botón; el cliente lo vería cortado.
const MAX_TITULO_BOTON = 20;

describe('opciones-social', () => {
  it('ningún botón fijo pasa de 20 caracteres', () => {
    const botones = [
      ...BOTONES_INICIO,
      ...BOTONES_TRAS_PRECIO,
      ...BOTONES_ARMAR_PEDIDO,
    ];
    for (const { titulo } of botones) {
      expect([...titulo].length).toBeLessThanOrEqual(MAX_TITULO_BOTON);
    }
  });

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

  it('los botones de las más pedidas abren cada pizza y ofrecen el menú completo', () => {
    const pizza = (id: string, nombre: string) => ({
      id,
      nombre,
      descripcion: null,
      imagen_url: null,
      destacado: false,
      categoria_id: 'c',
      slug: null,
      ventas_historicas: null,
      variantes: [],
    });
    const botones = botonesMasPedidas([
      pizza('p1', 'Pizza Horebs Especial'),
      pizza('p2', 'Pizza de Jamón y Queso'),
    ]);
    expect(botones).toEqual([
      { id: 'ped:p:p1', titulo: '🍕 Horebs Especial' },
      { id: 'ped:p:p2', titulo: '🍕 Jamón y Queso' },
      { id: 'mnu:menu', titulo: '📋 Ver menú completo' },
      { id: 'mnu:humano', titulo: '💬 Una persona' },
    ]);
  });
});
