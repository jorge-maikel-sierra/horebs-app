import type { MetadataRoute } from 'next';
import { NEGOCIO } from '@/lib/negocio';

const SITE_URL = `https://${NEGOCIO.sitio}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type Producto = { slug: string | null; ventas_historicas: number | null };
type Post = { slug: string; publicado_en: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paginasEstaticas: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/catalogo`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/contacto`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  let productos: Producto[] = [];
  try {
    const res = await fetch(`${API_URL}/catalogo/productos`, {
      cache: 'no-store',
    });
    if (res.ok) productos = await res.json();
  } catch {
    // API no disponible al generar el sitemap: seguimos solo con las
    // páginas estáticas en vez de romper el build.
  }

  const pizzas = productos.filter((p) => p.slug);
  const maxVentas = Math.max(1, ...pizzas.map((p) => p.ventas_historicas ?? 0));

  const paginasProducto: MetadataRoute.Sitemap = pizzas.map((p) => ({
    url: `${SITE_URL}/menu/${p.slug}`,
    changeFrequency: 'weekly',
    // Prioridad ponderada por ventas históricas reales, no por cuál
    // producto "suena" a estrella de la casa.
    priority: Number(
      (0.5 + 0.4 * ((p.ventas_historicas ?? 0) / maxVentas)).toFixed(2),
    ),
  }));

  let posts: Post[] = [];
  try {
    const res = await fetch(`${API_URL}/blog/posts`, { cache: 'no-store' });
    if (res.ok) posts = await res.json();
  } catch {
    // API no disponible al generar el sitemap.
  }

  const paginasBlog: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
    lastModified: post.publicado_en ?? undefined,
  }));

  return [...paginasEstaticas, ...paginasProducto, ...paginasBlog];
}
