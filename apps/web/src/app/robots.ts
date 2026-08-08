import type { MetadataRoute } from 'next';
import { NEGOCIO } from '@/lib/negocio';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `https://${NEGOCIO.sitio}/sitemap.xml`,
  };
}
