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
  it('cada tamaño con su precio, el domicilio con un total de ejemplo y la pregunta de cierre', () => {
    expect(textoPrecioProducto(ESPECIAL, VIERNES)).toBe(
      'Pizza Horebs Especial, la firma de la casa 🍕\n' +
        '• Personal $25.000 (6 porciones)\n' +
        '• Mediana $40.000 (8 porciones)\n' +
        '• Grande $60.000 (12 porciones)\n' +
        '🛵 Domicilio $5.000 a toda la zona urbana de Riohacha: la mediana te llega en $45.000.\n' +
        '¿Te la mando hoy? Toca el tamaño y te la agrego al pedido 👇',
    );
  });

  it('miércoles antes de las 8 p.m.: el precio ya trae el 20% y el total también', () => {
    const texto = textoPrecioProducto(ESPECIAL, MIERCOLES);
    expect(texto).toContain('• Mediana $32.000 con el 20% (antes $40.000)');
    expect(texto).toContain('la mediana te llega en $37.000');
    expect(texto).toContain(
      '🎉 Hoy tienes 20% de descuento en pizzas hasta las 8:00 p.m., y se aplica solo al pedir por aquí.',
    );
  });

  it('sin mediana, el ejemplo usa el tamaño más barato', () => {
    expect(textoPrecioProducto(HAWAIANA, VIERNES)).toContain(
      'la personal te llega en $25.000',
    );
  });

  it('lo que no es pizza no lleva porciones, ni 20% ni total de ejemplo', () => {
    const texto = textoPrecioProducto(PANZEROTTI, MIERCOLES);
    expect(texto).toContain('• Sabor jamón $18.000\n');
    expect(texto).not.toContain('20%');
    expect(texto).toContain(
      '🛵 Domicilio $5.000 a toda la zona urbana de Riohacha.\n',
    );
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
