import { NEGOCIO } from './negocio';

const SITE_URL = `https://${NEGOCIO.sitio}`;

/**
 * Schema.org Restaurant — el equivalente a lo que agrega un plugin de Local
 * SEO en WooCommerce (Yoast Local SEO, etc). Va en el layout raíz para que
 * aparezca en todas las páginas del sitio.
 */
export function restauranteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${SITE_URL}/#restaurante`,
    name: NEGOCIO.nombre,
    url: SITE_URL,
    image: `${SITE_URL}/logo-horebs.png`,
    logo: `${SITE_URL}/logo-horebs.png`,
    telephone: `+${NEGOCIO.whatsappNumero}`,
    priceRange: '$$',
    servesCuisine: ['Pizza', 'Italiana'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Carrera 7 # 17B - 66',
      addressLocality: 'Riohacha',
      addressRegion: 'La Guajira',
      addressCountry: 'CO',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: NEGOCIO.latitud,
      longitude: NEGOCIO.longitud,
    },
    hasMap: NEGOCIO.googleReviews,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '16:00',
        closes: '23:00',
      },
    ],
    menu: `${SITE_URL}/catalogo`,
    acceptsReservations: 'False',
    sameAs: [NEGOCIO.facebook, NEGOCIO.instagram],
  };
}

type BreadcrumbItem = { nombre: string; ruta: string };

/** BreadcrumbList — lo que hace que Google muestre migas de pan en vez de la URL cruda. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nombre,
      item: `${SITE_URL}${item.ruta}`,
    })),
  };
}

/** Serializa JSON-LD de forma segura para inyectar en un <script>. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
