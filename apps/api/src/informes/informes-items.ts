import { acumularProducto } from './informes-agregados';
import type { InformeCategoriaDto, InformeProductoDto } from './informes.tipos';

const MAX_TOP_PRODUCTOS = 8;
const SIN_CATEGORIA = 'Personalizado';

interface ProductoAnidado {
  nombre?: string;
  categorias?: { nombre?: string } | null;
}

/** Fila de `items_pedido` con su producto y categoría anidados. */
export interface ItemVivoFila {
  cantidad: number;
  subtotal: number;
  nombre_personalizado: string | null;
  variantes_producto?: { productos?: ProductoAnidado | null } | null;
}

/** Fila de `historico_items_pedido` (WooCommerce) con su producto anidado. */
export interface ItemHistoricoFila {
  cantidad: number;
  subtotal: number;
  producto_nombre: string;
  variantes_producto?: { productos?: ProductoAnidado | null } | null;
}

export interface ResumenItems {
  topProductos: InformeProductoDto[];
  porCategoria: InformeCategoriaDto[];
  articulosVendidos: number;
}

type Totales = Map<string, { cantidad: number; total: number }>;

const ordenadoPorTotal = (mapa: Totales): InformeProductoDto[] =>
  [...mapa.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.total - a.total);

/**
 * Totales por producto y por categoría de los ítems vendidos en vivo y de
 * los migrados. Un ítem sin producto de catálogo cae en "Personalizado".
 */
export function agregarItems(
  vivos: ItemVivoFila[],
  historicos: ItemHistoricoFila[],
): ResumenItems {
  const porProducto: Totales = new Map();
  const porCategoria: Totales = new Map();
  let articulosVendidos = 0;

  const sumar = (
    producto: string,
    categoria: string,
    cantidad: number,
    subtotal: number,
  ): void => {
    articulosVendidos += cantidad;
    acumularProducto(porProducto, producto, cantidad, subtotal);
    acumularProducto(porCategoria, categoria, cantidad, subtotal);
  };

  for (const item of vivos) {
    const producto = item.variantes_producto?.productos;
    sumar(
      producto?.nombre ?? item.nombre_personalizado ?? 'Personalizado',
      producto?.categorias?.nombre ?? SIN_CATEGORIA,
      item.cantidad,
      item.subtotal,
    );
  }
  for (const item of historicos) {
    const producto = item.variantes_producto?.productos;
    sumar(
      producto?.nombre ?? item.producto_nombre,
      producto?.categorias?.nombre ?? SIN_CATEGORIA,
      item.cantidad,
      item.subtotal,
    );
  }

  return {
    topProductos: ordenadoPorTotal(porProducto).slice(0, MAX_TOP_PRODUCTOS),
    porCategoria: ordenadoPorTotal(porCategoria),
    articulosVendidos,
  };
}
