import {
  agregarItems,
  type ItemHistoricoFila,
  type ItemVivoFila,
} from './informes-items';

const vivo = (
  cantidad: number,
  subtotal: number,
  producto?: string,
  categoria?: string,
  personalizado: string | null = null,
): ItemVivoFila => ({
  cantidad,
  subtotal,
  nombre_personalizado: personalizado,
  variantes_producto: producto
    ? { productos: { nombre: producto, categorias: { nombre: categoria } } }
    : null,
});

const historico = (
  cantidad: number,
  subtotal: number,
  nombreHistorico: string,
): ItemHistoricoFila => ({
  cantidad,
  subtotal,
  producto_nombre: nombreHistorico,
  variantes_producto: null,
});

describe('agregarItems', () => {
  it('suma vivos y migrados por producto y por categoría', () => {
    const resumen = agregarItems(
      [
        vivo(2, 56000, 'Pizza Hawaiana', 'Pizzas'),
        vivo(1, 28000, 'Pizza Hawaiana', 'Pizzas'),
        vivo(3, 9000, 'Cola', 'Bebidas'),
      ],
      [historico(1, 30000, 'Pizza vieja')],
    );
    expect(resumen.articulosVendidos).toBe(7);
    expect(resumen.topProductos[0]).toEqual({
      nombre: 'Pizza Hawaiana',
      cantidad: 3,
      total: 84000,
    });
    expect(resumen.porCategoria.map((c) => c.nombre)).toEqual([
      'Pizzas',
      'Personalizado',
      'Bebidas',
    ]);
  });

  it('un ítem sin producto de catálogo usa su nombre personalizado', () => {
    const resumen = agregarItems(
      [vivo(1, 5000, undefined, undefined, 'Pizza especial')],
      [],
    );
    expect(resumen.topProductos[0].nombre).toBe('Pizza especial');
    expect(resumen.porCategoria[0].nombre).toBe('Personalizado');
  });

  it('el top se limita a 8 productos', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      vivo(1, (i + 1) * 1000, `P${i}`, 'Pizzas'),
    );
    const resumen = agregarItems(items, []);
    expect(resumen.topProductos).toHaveLength(8);
    expect(resumen.topProductos[0].nombre).toBe('P9');
  });

  it('sin ítems devuelve vacío', () => {
    expect(agregarItems([], [])).toEqual({
      topProductos: [],
      porCategoria: [],
      articulosVendidos: 0,
    });
  });
});
