import {
  COLUMNAS_FEED,
  csvDeFilas,
  escaparCampoCsv,
  filasDeProducto,
} from './catalogo-feed';
import type { ProductoDto } from './catalog.service';

const CATEGORIAS = new Map([['cat-1', 'Pizzas']]);

function producto(extra: Partial<ProductoDto> = {}) {
  return {
    id: 'p-1',
    nombre: 'Hawaiana',
    descripcion: null,
    imagen_url: 'https://img/hawaiana.jpg',
    destacado: false,
    categoria_id: 'cat-1',
    slug: 'hawaiana',
    ventas_historicas: null,
    variantes: [
      { id: 'v-1', nombre: 'Personal', precio: 18000, precio_oferta: null },
    ],
    ...extra,
  } as ProductoDto & { imagen_url: string; slug: string };
}

describe('escaparCampoCsv', () => {
  it('deja igual un texto sin comas, comillas ni saltos', () => {
    expect(escaparCampoCsv('Pizza Hawaiana')).toBe('Pizza Hawaiana');
  });

  it('entrecomilla y duplica las comillas', () => {
    expect(escaparCampoCsv('Con "piña", jamón')).toBe('"Con ""piña"", jamón"');
    expect(escaparCampoCsv('dos\nlíneas')).toBe('"dos\nlíneas"');
  });
});

describe('filasDeProducto', () => {
  it('una variante: título del producto, sin grupo ni oferta', () => {
    const [fila] = filasDeProducto(producto(), CATEGORIAS);

    expect(fila).toHaveLength(COLUMNAS_FEED.length);
    expect(fila).toEqual([
      'v-1',
      'Hawaiana',
      'Hawaiana — Pizzería Horebs, Riohacha.',
      'in stock',
      'new',
      '18000.00 COP',
      'https://pizzeriahorebs.shop/menu/hawaiana',
      'https://img/hawaiana.jpg',
      'Pizzería Horebs',
      '',
      '',
      'active',
      'Pizzas',
    ]);
  });

  it('varias variantes comparten item_group_id y suman el tamaño al título', () => {
    const filas = filasDeProducto(
      producto({
        variantes: [
          { id: 'v-1', nombre: 'Personal', precio: 18000, precio_oferta: null },
          { id: 'v-2', nombre: 'Grande', precio: 42000, precio_oferta: null },
        ],
      }),
      CATEGORIAS,
    );

    expect(filas.map((f) => f[1])).toEqual([
      'Hawaiana - Personal',
      'Hawaiana - Grande',
    ]);
    expect(filas.map((f) => f[9])).toEqual(['p-1', 'p-1']);
  });

  it('solo informa sale_price si la oferta es menor al precio', () => {
    const [conOferta, sinOferta] = filasDeProducto(
      producto({
        variantes: [
          { id: 'v-1', nombre: 'A', precio: 20000, precio_oferta: 15000 },
          { id: 'v-2', nombre: 'B', precio: 20000, precio_oferta: 25000 },
        ],
      }),
      CATEGORIAS,
    );

    expect(conOferta[10]).toBe('15000.00 COP');
    expect(sinOferta[10]).toBe('');
  });

  it('usa la descripción del producto cuando existe', () => {
    const [fila] = filasDeProducto(
      producto({ descripcion: '  Jamón y piña  ' }),
      CATEGORIAS,
    );

    expect(fila[2]).toBe('Jamón y piña');
  });

  it('una categoría desconocida queda vacía', () => {
    const [fila] = filasDeProducto(
      producto({ categoria_id: 'otra' }),
      CATEGORIAS,
    );

    expect(fila[12]).toBe('');
  });
});

describe('csvDeFilas', () => {
  it('arranca con el encabezado y escapa cada campo', () => {
    const csv = csvDeFilas([['a', 'b,c']]);

    expect(csv.split('\n')).toEqual([COLUMNAS_FEED.join(','), 'a,"b,c"']);
  });
});
