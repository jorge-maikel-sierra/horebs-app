import type { Metadata } from 'next';
import { NEGOCIO } from '@/lib/negocio';

type OpenGraph = NonNullable<Metadata['openGraph']>;

const IMAGEN_ALT =
  'Pizza Horebs Especial recién horneada, con el queso estirándose al servir una porción';

/**
 * Open Graph de una página con su `og:url`. Next fusiona la metadata de
 * forma superficial: si una página define `openGraph`, reemplaza entero el
 * del layout, incluida la imagen de app/opengraph-image.jpg. Por eso aquí se
 * repiten el nombre del sitio, el idioma y esa imagen por defecto.
 */
export function openGraphPagina(ruta: string, extra?: OpenGraph): OpenGraph {
  return {
    siteName: NEGOCIO.nombre,
    locale: 'es_CO',
    type: 'website',
    url: ruta,
    images: [{ url: '/opengraph-image.jpg', width: 1200, height: 630, alt: IMAGEN_ALT }],
    ...extra,
  } as OpenGraph;
}

/** Metadata de las páginas privadas (carrito, checkout, cuenta, pedido). */
export const METADATA_PRIVADA: Metadata = {
  robots: { index: false, follow: true },
};
