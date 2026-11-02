import type { ProductoDto } from './catalog.service';

const SITIO_URL = 'https://pizzeriahorebs.shop';
const MARCA = 'Pizzería Horebs';
const MONEDA = 'COP';
const DECIMALES_PRECIO = 2;

export const COLUMNAS_FEED = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'item_group_id',
  'sale_price',
  'status',
  'custom_label_0',
] as const;

type ProductoDelFeed = ProductoDto & { imagen_url: string; slug: string };

export function escaparCampoCsv(valor: string): string {
  if (/[",\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function precioFeed(valor: number): string {
  return `${valor.toFixed(DECIMALES_PRECIO)} ${MONEDA}`;
}

/** Una fila por variante; si hay varias, comparten `item_group_id`. */
export function filasDeProducto(
  producto: ProductoDelFeed,
  nombreCategoria: Map<string, string>,
): string[][] {
  const esGrupoDeVariantes = producto.variantes.length > 1;
  const link = `${SITIO_URL}/menu/${producto.slug}`;
  const descripcion =
    producto.descripcion?.trim() ||
    `${producto.nombre} — Pizzería Horebs, Riohacha.`;

  return producto.variantes.map((variante) => {
    const title = esGrupoDeVariantes
      ? `${producto.nombre} - ${variante.nombre}`
      : producto.nombre;
    const oferta = variante.precio_oferta;
    const tieneOferta = oferta != null && oferta < variante.precio;

    return [
      variante.id,
      title,
      descripcion,
      'in stock',
      'new',
      precioFeed(variante.precio),
      link,
      producto.imagen_url,
      MARCA,
      esGrupoDeVariantes ? producto.id : '',
      tieneOferta ? precioFeed(oferta) : '',
      'active',
      nombreCategoria.get(producto.categoria_id) ?? '',
    ];
  });
}

export function csvDeFilas(filas: string[][]): string {
  return [
    COLUMNAS_FEED.join(','),
    ...filas.map((fila) => fila.map(escaparCampoCsv).join(',')),
  ].join('\n');
}
