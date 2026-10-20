import { TAMANOS } from '@/lib/tamanos';

export type Variante = {
  id?: string;
  nombre?: string;
  precio: number;
  precio_oferta: number | null;
};

export type ProductoCarta = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  slug: string | null;
  destacado: boolean;
  ventas_historicas?: number | null;
  variantes: Variante[];
};

export type NombreTamano = keyof typeof TAMANOS;

export const NOMBRES_TAMANO = Object.keys(TAMANOS) as NombreTamano[];

export function precioVariante(v: Variante): number {
  return v.precio_oferta ?? v.precio;
}

export function precioDesde(producto: ProductoCarta): number | null {
  if (producto.variantes.length === 0) return null;
  return Math.min(...producto.variantes.map(precioVariante));
}

/** Precio del tamaño pedido, o null si la pizza no viene en ese tamaño. */
export function precioTamano(producto: ProductoCarta, tamano: string): number | null {
  const v = producto.variantes.find((x) => x.nombre === tamano);
  return v ? precioVariante(v) : null;
}

/** Es pizza si alguna variante se llama como un tamaño (Personal, Mediana…). */
export function esPizza(producto: ProductoCarta): boolean {
  return producto.variantes.some((v) => v.nombre !== undefined && v.nombre in TAMANOS);
}

export function hrefProducto(producto: ProductoCarta): string {
  return producto.slug ? `/menu/${producto.slug}` : '/catalogo';
}
