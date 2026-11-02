import type {
  ItemCarritoResuelto,
  ProductoDto,
} from '../catalog/catalog.service';
import {
  adicionalesDeCatalogo,
  adicionalMencionado,
  esAdicional,
  nombreCortoAdicional,
  pizzasDelCarrito,
  respuestaEsNo,
  respuestaEsSi,
  sumarAlCarrito,
  varianteParaTamano,
} from './adicionales';

const PRECIOS: [string, number][] = [
  ['Personal', 5000],
  ['Mediana', 9000],
  ['Grande', 12000],
];

function producto(id: string, nombre: string): ProductoDto {
  return {
    id,
    nombre,
    descripcion: null,
    imagen_url: null,
    destacado: false,
    categoria_id: 'c',
    slug: null,
    ventas_historicas: null,
    variantes: PRECIOS.map(([n, precio]) => ({
      id: `${id}-${n}`,
      nombre: n,
      precio,
      precio_oferta: null,
    })),
  };
}

const BORDE = producto('ad-borde', 'Adicional: Borde de queso');
const PIMENTON = producto('ad-pim', 'Adicional: Pimentón verde');
const PIÑA = producto('ad-pina', 'Adicional: Piña');
const PEPPERONI = producto('ad-pep', 'Adicional: Pepperoni');
const ADICIONALES = [BORDE, PIMENTON, PIÑA, PEPPERONI];

function item(
  productoNombre: string,
  varianteNombre: string,
  conTamanos = true,
): ItemCarritoResuelto {
  return {
    varianteId: `${productoNombre}-${varianteNombre}`,
    productoNombre,
    varianteNombre,
    conTamanos,
    cantidad: 1,
    precio: 30000,
  };
}

describe('adicionales', () => {
  it('reconoce el adicional por su prefijo y le quita el prefijo para mostrarlo', () => {
    expect(esAdicional('Adicional: Borde de queso')).toBe(true);
    expect(esAdicional('Pizza Borde de Queso')).toBe(false);
    expect(nombreCortoAdicional('Adicional: Piña')).toBe('Piña');
    expect(nombreCortoAdicional('Pizza Hawaiana')).toBe('Pizza Hawaiana');
  });

  it('solo las pizzas con tamaño reciben adicionales', () => {
    const carrito = [
      item('Pizza Hawaiana', 'Mediana'),
      item('Panzerotti', 'Sabor jamón'),
      item('Bebidas', 'Sprite 400ml'),
      item('Adicional: Piña', 'Mediana'),
      item('Pizza Margarita', 'Grande'),
    ];

    expect(pizzasDelCarrito(carrito).map((i) => i.productoNombre)).toEqual([
      'Pizza Hawaiana',
      'Pizza Margarita',
    ]);
  });

  it('el catálogo de adicionales deja fuera pizzas y productos sin variantes', () => {
    const sinVariantes = { ...PIÑA, variantes: [] };

    expect(
      adicionalesDeCatalogo([
        producto('p', 'Pizza Hawaiana'),
        BORDE,
        sinVariantes,
      ]),
    ).toEqual([BORDE]);
  });

  it.each([
    ['Personal', 5000],
    ['Mediana', 9000],
    ['Grande', 12000],
    ['mediana', 9000],
  ])('el precio del adicional en %s es %i', (tamano, precio) => {
    expect(varianteParaTamano(BORDE, tamano)?.precio).toBe(precio);
  });

  it('un tamaño que el adicional no tiene da null', () => {
    expect(varianteParaTamano(BORDE, 'Familiar')).toBeNull();
  });

  it('suma al carrito y junta la misma variante', () => {
    const base = [{ varianteId: 'a', cantidad: 1 }];

    expect(sumarAlCarrito(base, 'b')).toEqual([
      { varianteId: 'a', cantidad: 1 },
      { varianteId: 'b', cantidad: 1 },
    ]);
    expect(sumarAlCarrito(sumarAlCarrito(base, 'b'), 'b')).toEqual([
      { varianteId: 'a', cantidad: 1 },
      { varianteId: 'b', cantidad: 2 },
    ]);
  });

  describe('adicionalMencionado', () => {
    it.each([
      ['con borde de queso', BORDE],
      ['Agrégame un borde de queso porfa', BORDE],
      ['quiero un adicional de pimentón verde', PIMENTON],
      ['con piña', PIÑA],
      ['ponle extra pepperoni', PEPPERONI],
    ])('"%s" es un adicional', (texto, esperado) => {
      expect(adicionalMencionado(texto, ADICIONALES)).toBe(esperado);
    });

    it.each([
      'borde de queso',
      'una pizza hawaiana con piña',
      'cuánto cuesta el pepperoni',
      'Ana Piña',
      'hola',
    ])('"%s" no se toma como adicional', (texto) => {
      expect(adicionalMencionado(texto, ADICIONALES)).toBeNull();
    });
  });

  it('entiende un sí y un no escritos', () => {
    expect(respuestaEsNo('No gracias')).toBe(true);
    expect(respuestaEsNo('listo')).toBe(true);
    expect(respuestaEsNo('sí quiero')).toBe(false);
    expect(respuestaEsSi('Sí, dale')).toBe(true);
    expect(respuestaEsSi('no')).toBe(false);
  });
});
