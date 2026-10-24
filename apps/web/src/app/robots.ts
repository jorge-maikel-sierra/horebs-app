import type { MetadataRoute } from 'next';
import { NEGOCIO } from '@/lib/negocio';

export default function robots(): MetadataRoute.Robots {
  return {
    // Carrito, checkout, cuenta y pedido no se bloquean aquí: llevan
    // noindex, y Google solo lo ve si puede rastrear la página.
    rules: { userAgent: '*', allow: '/', disallow: '/admin' },
    sitemap: `https://${NEGOCIO.sitio}/sitemap.xml`,
  };
}
