import type { ProductoDto } from '../catalog/catalog.service';
import {
  botonesPrecioProducto,
  productoEnContexto,
  respuestaTamanoProducto,
  textoPrecioProducto,
} from './texto-producto';
import { MEDIDAS_TAMANO } from './tamanos-pizza';

const producto = (
  id: string,
  nombre: string,
  variantes: [string, number][],
): ProductoDto => ({
  id,
  nombre,
  descripcion: null,
  imagen_url: null,
  destacado: false,
  categoria_id: 'c',
  slug: id,
  ventas_historicas: null,
  variantes: variantes.map(([n, precio]) => ({
    id: `${id}-${n}`,
    nombre: n,
    precio,
    precio_oferta: null,
  })),
});

const ESPECIAL = producto('he', 'Pizza Horebs Especial', [
  ['Grande', 60000],
  ['Personal', 25000],
  ['Mediana', 40000],
]);
const HAWAIANA = producto('hw', 'Pizza Hawaiana', [['Personal', 20000]]);
const PANZEROTTI = producto('pz', 'Panzerotti', [['Sabor jamón', 18000]]);
const MEDIANA = MEDIDAS_TAMANO[1];

// Viernes 13 nov 2026 (sin 20%) y miércoles 11 nov 2026 a las 3 p.m. (con 20%).
const VIERNES = new Date('2026-11-13T15:00:00-05:00');
const MIERCOLES = new Date('2026-11-11T15:00:00-05:00');

describe('textoPrecioProducto', () => {
  it('cada tamaño con su precio y porciones, del más barato al más caro', () => {
    expect(textoPrecioProducto(ESPECIAL, VIERNES)).toBe(
      'Pizza Horebs Especial, la firma de la casa 🍕\n' +
        '• Personal $25.000 (6 porciones)\n' +
        '• Mediana $40.000 (8 porciones)\n' +
        '• Grande $60.000 (12 porciones)\n' +
        'Toca el tamaño y te la agrego al pedido 👇',
    );
  });

  it('los miércoles antes de las 8 p.m. avisa el 20% en pizzas', () => {
    expect(textoPrecioProducto(HAWAIANA, MIERCOLES)).toContain(
      '🎉 Hoy tienes 20% de descuento en pizzas hasta las 8:00 p.m.',
    );
    expect(textoPrecioProducto(PANZEROTTI, MIERCOLES)).not.toContain('20%');
  });

  it('lo que no es pizza no lleva porciones', () => {
    const texto = textoPrecioProducto(PANZEROTTI, VIERNES);
    expect(texto).toContain('• Sabor jamón $18.000\n');
    expect(texto).toContain('te lo agrego al pedido');
  });
});

describe('botones y tamaño puntual', () => {
  it('los botones son los tamaños (directo al carrito) y el menú', () => {
    expect(botonesPrecioProducto(ESPECIAL).map((b) => b.id)).toEqual([
      'ped:v:he-Personal',
      'ped:v:he-Mediana',
      'ped:v:he-Grande',
      'mnu:menu',
    ]);
  });

  it('responde la mediana de esa pizza con su precio y botón para pedirla', () => {
    const r = respuestaTamanoProducto(ESPECIAL, MEDIANA);
    expect(r?.texto).toContain(
      'La Pizza Horebs Especial mediana trae 8 porciones (30 cm) y vale $40.000',
    );
    expect(r?.botones[0]).toEqual({
      id: 'ped:v:he-Mediana',
      titulo: '🛒 Pedir mediana',
    });
    expect(respuestaTamanoProducto(HAWAIANA, MEDIANA)).toBeNull();
  });
});

describe('productoEnContexto', () => {
  const MENU = [ESPECIAL, HAWAIANA, PANZEROTTI];

  it('toma el único producto del mensaje más reciente del bot', () => {
    expect(
      productoEnContexto(
        ['Pizza Horebs Especial, la firma de la casa 🍕', 'Hola'],
        MENU,
      ),
    ).toBe(ESPECIAL);
  });

  it('si el mensaje más reciente no nombra ninguno, mira el anterior', () => {
    expect(
      productoEnContexto(
        ['Así son nuestras pizzas', 'Pizza Hawaiana 🍕'],
        MENU,
      ),
    ).toBe(HAWAIANA);
  });

  it('si nombra varios (menú, más pedidas), no hay uno claro', () => {
    expect(
      productoEnContexto(
        ['Productos mostrados: Pizza Horebs Especial, Pizza Hawaiana'],
        MENU,
      ),
    ).toBeNull();
    expect(productoEnContexto([], MENU)).toBeNull();
  });
});
