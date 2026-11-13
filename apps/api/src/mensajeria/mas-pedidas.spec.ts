import type { CategoriaDto, ProductoDto } from '../catalog/catalog.service';
import { elegirMasPedidas, textoMasPedidas } from './mas-pedidas';

const CATEGORIAS: CategoriaDto[] = [
  { id: 'cat-pizza', nombre: 'Pizza', orden: 1 },
  { id: 'cat-beb', nombre: 'Bebidas', orden: 2 },
  { id: 'cat-ad', nombre: 'Adicionales', orden: 3 },
];

const producto = (
  id: string,
  nombre: string,
  extra: Partial<ProductoDto> = {},
): ProductoDto => ({
  id,
  nombre,
  descripcion: null,
  imagen_url: null,
  destacado: false,
  categoria_id: 'cat-pizza',
  slug: id,
  ventas_historicas: null,
  variantes: [
    { id: `${id}-p`, nombre: 'Personal', precio: 20000, precio_oferta: null },
    { id: `${id}-g`, nombre: 'Grande', precio: 45000, precio_oferta: null },
    { id: `${id}-m`, nombre: 'Mediana', precio: 35000, precio_oferta: null },
  ],
  ...extra,
});

const MENU: ProductoDto[] = [
  producto('hw', 'Pizza Hawaiana', {
    destacado: true,
    ventas_historicas: 2960,
  }),
  producto('he', 'Pizza Horebs Especial', {
    destacado: true,
    ventas_historicas: 1904,
  }),
  producto('jq', 'Pizza de Jamón y Queso', { ventas_historicas: 3592 }),
  producto('ma', 'Pizza Margarita', { ventas_historicas: 100 }),
  producto('be', 'Bebidas', {
    categoria_id: 'cat-beb',
    ventas_historicas: 9999,
  }),
  producto('ad', 'Adicional: Piña', { categoria_id: 'cat-ad' }),
];

const nombres = (ps: ProductoDto[]): string[] => ps.map((p) => p.nombre);

describe('elegirMasPedidas', () => {
  it('respeta el orden del ranking de pedidos reales', () => {
    expect(
      nombres(elegirMasPedidas(['he', 'hw', 'jq'], MENU, CATEGORIAS)),
    ).toEqual([
      'Pizza Horebs Especial',
      'Pizza Hawaiana',
      'Pizza de Jamón y Queso',
    ]);
  });

  it('si el ranking trae menos de 3, completa con ventas históricas y sin repetir', () => {
    expect(nombres(elegirMasPedidas(['ma'], MENU, CATEGORIAS))).toEqual([
      'Pizza Margarita',
      'Pizza de Jamón y Queso',
      'Pizza Hawaiana',
    ]);
  });

  it('sin ranking (la consulta falló) usa ventas históricas y solo pizzas', () => {
    const elegidas = elegirMasPedidas([], MENU, CATEGORIAS);
    expect(nombres(elegidas)).toEqual([
      'Pizza de Jamón y Queso',
      'Pizza Hawaiana',
      'Pizza Horebs Especial',
    ]);
  });

  it('ignora ids del ranking que ya no están en el catálogo o no son pizza', () => {
    expect(
      nombres(
        elegirMasPedidas(['borrada', 'be', 'ad', 'he'], MENU, CATEGORIAS),
      ),
    ).toEqual([
      'Pizza Horebs Especial',
      'Pizza de Jamón y Queso',
      'Pizza Hawaiana',
    ]);
  });

  it('a igual venta histórica gana la destacada', () => {
    const empate = [
      producto('a', 'Pizza A'),
      producto('b', 'Pizza B', { destacado: true }),
    ];
    expect(nombres(elegirMasPedidas([], empate, CATEGORIAS, 1))).toEqual([
      'Pizza B',
    ]);
  });
});

describe('textoMasPedidas', () => {
  it('lleva solo las líneas de precio de las pizzas sugeridas y una pregunta', () => {
    const texto = textoMasPedidas(MENU.slice(0, 2));
    expect(texto).toBe(
      'Nuestras pizzas más pedidas 🍕\n' +
        '• Pizza Hawaiana: Personal $20.000 · Mediana $35.000 · Grande $45.000\n' +
        '• Pizza Horebs Especial: Personal $20.000 · Mediana $35.000 · Grande $45.000\n' +
        '¿Cuál te provoca?',
    );
  });
});
