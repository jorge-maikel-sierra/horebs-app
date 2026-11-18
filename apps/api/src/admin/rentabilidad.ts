/**
 * Utilidad bruta de los pedidos: lo vendido en productos menos lo que
 * cuestan hoy (costo vigente de cada variante; no hay costo congelado por venta). Solo cuenta los pedidos donde TODAS las líneas tienen costo; uno a
 * medias inflaría el margen. Los domicilios y los descuentos de puntos quedan
 * fuera: la utilidad es de los productos.
 */
export interface FilaItemCosto {
  cantidad: number;
  subtotal: number | string;
  /** El costo sale de la variante vendida: una línea personalizada no tiene variante ni costo. */
  variantes_producto: { costo: number | string | null } | null;
}

export interface UtilidadPedido {
  /** Lo vendido en productos en el pedido. */
  ventas: number;
  /** ventas − costo; solo tiene sentido si `completo`. */
  utilidad: number;
  /** Todas las líneas tenían costo. */
  completo: boolean;
}

export interface ResumenRentabilidad {
  ventas_productos: number;
  ventas_con_costo: number;
  costo_total: number;
  utilidad_bruta: number;
  /** Utilidad entre ventas de los pedidos con costo completo, en porcentaje. */
  margen_pct: number | null;
  /** Porcentaje de las ventas de productos que ya tiene costo. */
  cobertura_costos: number | null;
}

const CIEN = 100;
const DECIMALES = 10;

export function redondearUno(valor: number): number {
  return Math.round(valor * DECIMALES) / DECIMALES;
}

/** null si el pedido no tiene líneas que valorar. */
export function utilidadDePedido(
  items: FilaItemCosto[] | null | undefined,
): UtilidadPedido | null {
  if (!items || items.length === 0) return null;
  let ventas = 0;
  let costo = 0;
  let completo = true;
  for (const i of items) {
    ventas += Number(i.subtotal);
    const unitario = i.variantes_producto?.costo ?? null;
    if (unitario === null) {
      completo = false;
      continue;
    }
    costo += Number(unitario) * i.cantidad;
  }
  return { ventas, utilidad: ventas - costo, completo };
}

function porcentaje(parte: number, total: number): number | null {
  return total > 0 ? redondearUno((parte / total) * CIEN) : null;
}

/** Suma la rentabilidad de pedidos ya filtrados (sin cancelados). */
export function resumenRentabilidad(
  pedidos: { items_pedido?: FilaItemCosto[] | null }[],
): ResumenRentabilidad {
  let ventasProductos = 0;
  let ventasConCosto = 0;
  let utilidad = 0;
  for (const p of pedidos) {
    const u = utilidadDePedido(p.items_pedido);
    if (!u) continue;
    ventasProductos += u.ventas;
    if (!u.completo) continue;
    ventasConCosto += u.ventas;
    utilidad += u.utilidad;
  }
  return {
    ventas_productos: ventasProductos,
    ventas_con_costo: ventasConCosto,
    costo_total: ventasConCosto - utilidad,
    utilidad_bruta: utilidad,
    margen_pct: porcentaje(utilidad, ventasConCosto),
    cobertura_costos: porcentaje(ventasConCosto, ventasProductos),
  };
}

/** Margen de una variante: precio vigente menos costo; null si aún no tiene costo. */
export function margenDeVariante(
  precio: number,
  costo: number | null,
): { margen: number; margen_pct: number } | null {
  if (costo === null) return null;
  return {
    margen: precio - costo,
    margen_pct:
      precio > 0 ? redondearUno(((precio - costo) / precio) * CIEN) : 0,
  };
}
