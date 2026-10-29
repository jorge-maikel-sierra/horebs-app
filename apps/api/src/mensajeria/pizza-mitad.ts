import type {
  CategoriaDto,
  ProductoDto,
  VarianteProductoDto,
} from '../catalog/catalog.service';
import {
  buscarProductoUnico,
  elegirVariante,
  nombraTamano,
} from './busqueda-productos';
import { pesos } from './resumen-pedido';

/**
 * Pizza mitad y mitad: en cualquier tamaño el cliente puede pedir dos sabores
 * distintos y siempre se cobra el de mayor valor. Todo sale del catálogo, sin
 * que el modelo compare ni calcule precios.
 */

export interface PedidoMitadYMitad {
  sabor1: string;
  sabor2: string;
  /** "personal", "mediana" o "grande"; null si el cliente no lo dijo. */
  tamano: string | null;
}

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

/** Argumentos de la herramienta cotizar_pizza_mitad_y_mitad. */
export function pedidoMitadDeHerramienta(
  argumentos: Record<string, unknown>,
): PedidoMitadYMitad {
  return {
    sabor1: texto(argumentos.sabor_1),
    sabor2: texto(argumentos.sabor_2),
    tamano: texto(argumentos.tamano) || null,
  };
}

/** Ítem de calcular_pedido con `segundo_sabor`: `producto` es el primer sabor. */
export function pedidoMitadDeItem(
  item: Record<string, unknown>,
): PedidoMitadYMitad {
  return {
    sabor1: texto(item.producto),
    sabor2: texto(item.segundo_sabor),
    tamano: texto(item.tamano) || null,
  };
}

export type MitadYMitad =
  | {
      ok: true;
      /** Variante del sabor más caro: es la que se cobra y se guarda. */
      variante: VarianteProductoDto;
      precio: number;
      /** Para que el modelo se lo explique al cliente. */
      texto: string;
      /** Para dejar escrito en el pedido qué lleva la pizza. */
      nota: string;
    }
  | { ok: false; error: string };

/** Productos de las categorías cuyo nombre empieza por "pizza". */
export function esPizzaPorCategoria(
  categorias: CategoriaDto[],
): (producto: ProductoDto) => boolean {
  const ids = new Set(
    categorias
      .filter((c) => c.nombre.trim().toLowerCase().startsWith('pizza'))
      .map((c) => c.id),
  );
  return (producto) => ids.has(producto.categoria_id);
}

interface Sabor {
  producto: ProductoDto;
  variante: VarianteProductoDto;
  precio: number;
}

function elegirSabor(
  nombreBuscado: string,
  tamano: string,
  productos: ProductoDto[],
  esPizza: (producto: ProductoDto) => boolean,
): Sabor | string {
  const { encontrado, error } = buscarProductoUnico(nombreBuscado, productos);
  if (error) return error;
  if (!encontrado || !esPizza(encontrado)) {
    return `"${nombreBuscado}" no es una pizza: el mitad y mitad es solo entre pizzas.`;
  }
  const variante = elegirVariante(encontrado, tamano);
  // elegirVariante da la única variante de un producto aunque no sea la del
  // tamaño pedido; una pizza que no viene en ese tamaño no puede cobrarse.
  if (!variante || !nombraTamano(variante, tamano)) {
    return `${encontrado.nombre} no viene en tamaño ${tamano}.`;
  }
  return {
    producto: encontrado,
    variante,
    precio: variante.precio_oferta ?? variante.precio,
  };
}

export function armarMitadYMitad(
  pedido: PedidoMitadYMitad,
  productos: ProductoDto[],
  esPizza: (producto: ProductoDto) => boolean,
): MitadYMitad {
  const tamano = pedido.tamano?.trim();
  if (!tamano) {
    return {
      ok: false,
      error:
        'Falta el tamaño de la pizza mitad y mitad: preguntale al cliente si la quiere personal, mediana o grande.',
    };
  }
  const primero = elegirSabor(pedido.sabor1, tamano, productos, esPizza);
  if (typeof primero === 'string') return { ok: false, error: primero };
  const segundo = elegirSabor(pedido.sabor2, tamano, productos, esPizza);
  if (typeof segundo === 'string') return { ok: false, error: segundo };

  if (primero.producto.id === segundo.producto.id) {
    return {
      ok: false,
      error: `Los dos sabores tienen que ser distintos: ${primero.producto.nombre} dos veces es una pizza normal.`,
    };
  }

  const cobrado = segundo.precio > primero.precio ? segundo : primero;
  const nombres = `${primero.producto.nombre} y mitad ${segundo.producto.nombre}`;
  const tamanoNombre = cobrado.variante.nombre;
  return {
    ok: true,
    variante: cobrado.variante,
    precio: cobrado.precio,
    texto:
      `Pizza ${tamanoNombre} mitad ${nombres}: ${pesos(cobrado.precio)}. ` +
      `Se cobra el sabor de mayor valor (${primero.producto.nombre}: ${pesos(primero.precio)}; ` +
      `${segundo.producto.nombre}: ${pesos(segundo.precio)}). Vale para cualquier tamaño.`,
    nota:
      `Pizza ${tamanoNombre} mitad ${nombres}. ` +
      `Se cobra el sabor de mayor valor: ${cobrado.producto.nombre}, ${pesos(cobrado.precio)}.`,
  };
}
