import type { ProductoDto } from '../catalog/catalog.service';
import {
  elegirProductos,
  seccionesPorCategoria,
  tarjetasDe,
  textoDetalleProducto,
} from './seleccion-productos';

function producto(
  nombre: string,
  categoria: string,
  precios: number[],
  extra: Partial<ProductoDto> = {},
): ProductoDto {
  return {
    id: nombre,
    nombre,
    descripcion: null,
    imagen_url: null,
    destacado: false,
    categoria_id: categoria,
    slug: null,
    ventas_historicas: null,
    variantes: precios.map((precio, i) => ({
      id: `${nombre}-v${i}`,
      nombre: `Tamaño ${i}`,
      precio,
      precio_oferta: null,
    })),
    ...extra,
  };
}

const CATEGORIAS = [
  { id: 'pizzas', nombre: 'Pizzas' },
  { id: 'bebidas', nombre: 'Bebidas' },
];
const HAWAIANA = producto('Pizza Hawaiana', 'pizzas', [18000, 30000], {
  descripcion: 'Jamón y piña',
});
const MARGARITA = producto('Pizza Margarita', 'pizzas', [16000]);
const COLA = producto('Cola 400ml', 'bebidas', [4000]);
const MENU = [HAWAIANA, MARGARITA, COLA];

describe('elegirProductos', () => {
  it('un producto nombrado gana sobre su categoría', () => {
    expect(elegirProductos(MENU, CATEGORIAS, 'hawaiana')).toEqual([HAWAIANA]);
  });

  it('una categoría pedida trae todos sus productos', () => {
    expect(elegirProductos(MENU, CATEGORIAS, 'bebidas')).toEqual([COLA]);
    expect(elegirProductos(MENU, CATEGORIAS, 'las pizzas')).toEqual([
      HAWAIANA,
      MARGARITA,
    ]);
  });

  it('busca en la descripción si no hay nombre ni categoría', () => {
    expect(elegirProductos(MENU, CATEGORIAS, 'algo con piña')).toEqual([
      HAWAIANA,
    ]);
  });

  it('si nada coincide devuelve el menú completo en su orden', () => {
    expect(elegirProductos(MENU, CATEGORIAS, 'xyz')).toEqual(MENU);
    expect(elegirProductos(MENU, CATEGORIAS, '')).toEqual(MENU);
  });
});

describe('tarjetasDe', () => {
  it('toma hasta 3 productos con el precio más bajo de sus variantes', () => {
    const tarjetas = tarjetasDe([...MENU, producto('Extra', 'pizzas', [1000])]);
    expect(tarjetas).toHaveLength(3);
    expect(tarjetas[0]).toMatchObject({
      nombre: 'Pizza Hawaiana',
      precioDesde: 18000,
    });
  });

  it('la oferta de una variante cuenta como su precio', () => {
    const conOferta = producto('Oferta', 'pizzas', [20000]);
    conOferta.variantes[0].precio_oferta = 15000;
    expect(tarjetasDe([conOferta])[0].precioDesde).toBe(15000);
  });
});

describe('seccionesPorCategoria', () => {
  it('agrupa solo lo que entra al catálogo de Meta y quita las secciones vacías', () => {
    const conFoto = (p: ProductoDto): ProductoDto => ({
      ...p,
      imagen_url: 'https://img/x.jpg',
      slug: p.id,
    });
    const secciones = seccionesPorCategoria(
      [conFoto(HAWAIANA), MARGARITA, COLA],
      CATEGORIAS,
    );
    expect(secciones).toHaveLength(1);
    expect(secciones[0].titulo).toBe('Pizzas');
    expect(secciones[0].productos.map((p) => p.nombre)).toEqual([
      'Pizza Hawaiana',
    ]);
  });
});

describe('textoDetalleProducto', () => {
  it('lista la descripción y el precio de cada variante', () => {
    const texto = textoDetalleProducto(HAWAIANA);
    expect(texto).toContain('Pizza Hawaiana — Jamón y piña');
    expect(texto).toContain(`Tamaño 0: $${(18000).toLocaleString('es-CO')}`);
    expect(texto).toContain(`Tamaño 1: $${(30000).toLocaleString('es-CO')}`);
  });
});
