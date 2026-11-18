import { margenDeVariante } from './rentabilidad';

export interface FilaVarianteCosto {
  id: string;
  nombre: string;
  precio: number | string;
  precio_oferta: number | string | null;
  costo: number | string | null;
  activo: boolean;
  productos: { nombre: string; activo: boolean } | null;
}

export interface VarianteCostoDto {
  id: string;
  producto: string;
  variante: string;
  /** Precio con oferta si la tiene: es el que paga el cliente. */
  precio: number;
  costo: number | null;
  margen: number | null;
  margen_pct: number | null;
}

export interface ResumenCostosDto {
  variantes: number;
  con_costo: number;
  sin_costo: number;
}

export const SELECT_VARIANTE_COSTO =
  'id, nombre, precio, precio_oferta, costo, activo, productos(nombre, activo)';

export function varianteConCosto(fila: FilaVarianteCosto): VarianteCostoDto {
  const precio = Number(fila.precio_oferta ?? fila.precio);
  const costo = fila.costo === null ? null : Number(fila.costo);
  const margen = margenDeVariante(precio, costo);
  return {
    id: fila.id,
    producto: fila.productos?.nombre ?? '',
    variante: fila.nombre,
    precio,
    costo,
    margen: margen?.margen ?? null,
    margen_pct: margen?.margen_pct ?? null,
  };
}

/** Solo lo que se vende: variantes y productos activos, ordenados por producto y precio. */
export function variantesParaCostos(
  filas: FilaVarianteCosto[],
): VarianteCostoDto[] {
  return filas
    .filter((f) => f.activo && f.productos?.activo)
    .map(varianteConCosto)
    .sort(
      (a, b) =>
        a.producto.localeCompare(b.producto, 'es') || a.precio - b.precio,
    );
}

export function resumenCostos(variantes: VarianteCostoDto[]): ResumenCostosDto {
  const conCosto = variantes.filter((v) => v.costo !== null).length;
  return {
    variantes: variantes.length,
    con_costo: conCosto,
    sin_costo: variantes.length - conCosto,
  };
}
