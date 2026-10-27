import type { ProductoDto } from '../catalog/catalog.service';
import {
  buscarProductoUnico,
  contieneNumeroNoVerificado,
  elegirVariante,
} from './busqueda-productos';

function producto(
  id: string,
  nombre: string,
  variantes: [string, number][],
): ProductoDto {
  return {
    id,
    nombre,
    descripcion: null,
    imagen_url: null,
    destacado: false,
    categoria_id: 'c',
    slug: null,
    ventas_historicas: null,
    variantes: variantes.map(([nombreVariante, precio], i) => ({
      id: `${id}-v${i}`,
      nombre: nombreVariante,
      precio,
      precio_oferta: null,
    })),
  };
}

const TAMANOS: [string, number][] = [
  ['Personal', 18000],
  ['Mediana', 30000],
  ['Grande', 42000],
];
const JAMON_QUESO = producto('jq', 'Pizza de Jamón y Queso', TAMANOS);
const HAWAIANA = producto('hw', 'Pizza Hawaiana', TAMANOS);
const BEBIDAS = producto('beb', 'Bebidas', [
  ['Jugo Hit 400ml', 4000],
  ['Coca-Cola 1.5L', 7000],
]);
const CATALOGO = [JAMON_QUESO, HAWAIANA, BEBIDAS];

describe('elegirVariante', () => {
  // Bug real: "mediana" estaba entre las palabras ignoradas y ningún
  // tamaño de pizza se podía resolver — calcular_pedido siempre fallaba.
  it.each(['mediana', 'Mediana', 'la mediana', 'MEDIANA'])(
    'resuelve el tamaño "%s"',
    (tamano) => {
      expect(elegirVariante(JAMON_QUESO, tamano)?.nombre).toBe('Mediana');
    },
  );

  it('resuelve una bebida por su nombre de variante', () => {
    expect(elegirVariante(BEBIDAS, 'Jugo Hit 400ml')?.nombre).toBe(
      'Jugo Hit 400ml',
    );
  });

  it('sin tamaño, con varias variantes, no adivina', () => {
    expect(elegirVariante(JAMON_QUESO, null)).toBeUndefined();
  });

  it('con una sola variante no hace falta tamaño', () => {
    const unica = producto('u', 'Panzerotti', [['Única', 9000]]);
    expect(elegirVariante(unica, null)?.nombre).toBe('Única');
  });
});

describe('buscarProductoUnico', () => {
  it('encuentra el producto por nombre aunque traiga el tamaño', () => {
    expect(
      buscarProductoUnico('pizza hawaiana personal', CATALOGO).encontrado
        ?.nombre,
    ).toBe('Pizza Hawaiana');
  });

  // Bug real: "Jugo Hit 400ml" no matcheaba porque el producto se llama
  // "Bebidas" y la bebida es una variante.
  it('encuentra una bebida por el nombre de su variante', () => {
    const { encontrado, variante, error } = buscarProductoUnico(
      'Jugo Hit 400ml',
      CATALOGO,
    );
    expect(error).toBeUndefined();
    expect(encontrado?.nombre).toBe('Bebidas');
    expect(variante?.nombre).toBe('Jugo Hit 400ml');
  });

  it('avisa si el nombre es ambiguo', () => {
    const jamonPollo = producto('jp', 'Pizza Jamón Pollo', TAMANOS);
    expect(
      buscarProductoUnico('pizza de jamón', [...CATALOGO, jamonPollo]).error,
    ).toContain('es ambiguo');
  });

  it('avisa si no existe', () => {
    expect(buscarProductoUnico('lasagna', CATALOGO).error).toContain(
      'No se encontró',
    );
  });
});

describe('contieneNumeroNoVerificado', () => {
  it('detecta una cuenta inventada', () => {
    expect(
      contieneNumeroNoVerificado(
        'Transferí a Nequi al número *3001234567*',
        [],
      ),
    ).toBe(true);
  });

  it('acepta un número que devolvió una herramienta', () => {
    expect(
      contieneNumeroNoVerificado('Llave 1118843420', ['Llave: 1118843420']),
    ).toBe(false);
  });

  it('no confunde precios ni direcciones con un número largo', () => {
    expect(
      contieneNumeroNoVerificado(
        'Total: $39.000 a la carrera 7H1 # 33 - 66',
        [],
      ),
    ).toBe(false);
  });
});
