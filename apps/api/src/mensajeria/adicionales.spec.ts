import type {
  ItemCarritoResuelto,
  ProductoDto,
} from '../catalog/catalog.service';
import {
  adicionalesDeCatalogo,
  adicionalMencionado,
  esAdicional,
  esPreguntaDeAdicionales,
  nombreCortoAdicional,
  pizzasDelCarrito,
  respuestaEsNo,
  respuestaEsSi,
  sumarAlCarrito,
  textoAdicionales,
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

describe('esPreguntaDeAdicionales', () => {
  it.each([
    '¿Cuánto cuesta el borde de queso?',
    'Qué adicionales tienen?',
    'precio de los adicionales',
    'cuanto vale un extra de pepperoni',
    'Y el borde cuánto es',
  ])('"%s" es una pregunta por adicionales', (texto) => {
    expect(esPreguntaDeAdicionales(texto)).toBe(true);
  });

  it.each([
    'Me das precio',
    'cuánto cuesta la pizza borde de queso',
    'Me das una pizza especial con borde de queso mediana',
    'con borde de queso',
    'cuánto cuesta la ranchera',
    'hola',
  ])('"%s" no se contesta con la lista de adicionales', (texto) => {
    expect(esPreguntaDeAdicionales(texto)).toBe(false);
  });
});

describe('textoAdicionales', () => {
  it('con un solo precio por tamaño lo dice una vez, con los precios de la base', () => {
    const texto = textoAdicionales([
      producto('a', 'Adicional: Borde de queso'),
      producto('b', 'Adicional: Piña'),
      producto('c', 'Pizza Hawaiana'),
    ]);

    expect(texto).toContain('Personal $5.000, Mediana $9.000, Grande $12.000');
    expect(texto).toContain('Tenemos: borde de queso, piña');
    expect(texto).not.toMatch(/aproximad|suele|entre \$/i);
  });

  it('si un precio cambia en la base, el texto lo refleja', () => {
    const caro = producto('a', 'Adicional: Borde de queso');
    caro.variantes[1].precio = 10000;

    const texto = textoAdicionales([caro]);

    expect(texto).toContain('Mediana $10.000');
  });

  it('si los precios difieren entre adicionales los lista por separado', () => {
    const caro = producto('a', 'Adicional: Borde de queso');
    caro.variantes[1].precio = 10000;

    const texto = textoAdicionales([caro, producto('b', 'Adicional: Piña')]);

    expect(texto).toContain('Borde de queso: Personal $5.000, Mediana $10.000');
    expect(texto).toContain('Piña: Personal $5.000, Mediana $9.000');
  });

  it('sin adicionales cargados devuelve null', () => {
    expect(textoAdicionales([producto('c', 'Pizza Hawaiana')])).toBeNull();
  });
});
