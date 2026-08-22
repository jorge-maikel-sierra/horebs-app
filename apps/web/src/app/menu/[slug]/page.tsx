import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AgregarAlCarritoBoton from '@/components/AgregarAlCarritoBoton';
import ScrollReveal from '@/components/ScrollReveal';
import TrackViewItem from '@/components/TrackViewItem';
import { formatPrecio } from '@/lib/formato';
import { NEGOCIO } from '@/lib/negocio';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/json-ld';

type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  slug: string | null;
  ventas_historicas: number | null;
  variantes: Variante[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getProducto(slug: string): Promise<Producto | null> {
  const res = await fetch(`${API_URL}/catalogo/productos/${slug}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

async function getOtrasPizzasPopulares(slugActual: string): Promise<Producto[]> {
  const res = await fetch(`${API_URL}/catalogo/productos`, { cache: 'no-store' });
  if (!res.ok) return [];
  const productos: Producto[] = await res.json();

  return productos
    .filter((p) => p.slug && p.slug !== slugActual)
    .sort((a, b) => (b.ventas_historicas ?? 0) - (a.ventas_historicas ?? 0))
    .slice(0, 4);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const producto = await getProducto(slug);

  if (!producto) {
    return { title: `Producto no encontrado | ${NEGOCIO.nombre}` };
  }

  const title = `${producto.nombre} a domicilio en Riohacha | ${NEGOCIO.nombre}`;
  const description = producto.descripcion
    ? `${producto.descripcion} Pedí en línea o por WhatsApp — domicilio en Riohacha.`
    : `${producto.nombre} a domicilio en Riohacha. Pedí en línea o por WhatsApp.`;

  return {
    title,
    description,
    alternates: { canonical: `/menu/${slug}` },
    openGraph: {
      title,
      description,
      images: producto.imagen_url ? [producto.imagen_url] : undefined,
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [producto, otrasPizzas] = await Promise.all([
    getProducto(slug),
    getOtrasPizzasPopulares(slug),
  ]);

  if (!producto) notFound();

  const altDescriptivo = `${producto.nombre} a domicilio en Riohacha`;

  const urlProducto = `/menu/${slug}`;
  const urlProductoAbsoluta = `https://${NEGOCIO.sitio}${urlProducto}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion ?? undefined,
    image: producto.imagen_url ?? undefined,
    sku: producto.id,
    url: urlProductoAbsoluta,
    brand: { '@type': 'Brand', name: NEGOCIO.nombre },
    offers: producto.variantes.map((v) => ({
      '@type': 'Offer',
      name: v.nombre,
      price: String(v.precio_oferta ?? v.precio),
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      url: urlProductoAbsoluta,
    })),
  };

  const breadcrumbLd = breadcrumbJsonLd([
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Catálogo', ruta: '/catalogo' },
    { nombre: producto.nombre, ruta: urlProducto },
  ]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
      />
      <TrackViewItem nombre={producto.nombre} variantes={producto.variantes} />

      <Link
        href="/catalogo"
        className="text-sm text-brand-orange underline transition-colors hover:text-brand-orange/80"
      >
        ← Volver al catálogo
      </Link>

      <h1 className="animate-fade-up mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {producto.nombre} a domicilio en Riohacha
      </h1>

      {producto.imagen_url && (
        <div className="animate-fade-up delay-1 group relative mt-6 h-72 w-full overflow-hidden rounded-xl sm:h-96">
          <Image
            src={producto.imagen_url}
            alt={altDescriptivo}
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
        </div>
      )}

      {producto.descripcion && (
        <p className="animate-fade-up delay-2 mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          {producto.descripcion}
        </p>
      )}

      {producto.variantes.length > 0 && (
        <ul className="animate-fade-up delay-3 mt-6 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {producto.variantes.map((v) => (
            <li
              key={v.id}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2">
                {v.nombre}
                <AgregarAlCarritoBoton
                  varianteId={v.id}
                  productoNombre={producto.nombre}
                  varianteNombre={v.nombre}
                  precio={v.precio_oferta ?? v.precio}
                />
              </span>
              <span className="shrink-0 font-medium">
                {v.precio_oferta ? (
                  <>
                    <span className="mr-2 text-zinc-400 line-through">
                      {formatPrecio(v.precio)}
                    </span>
                    <span className="text-orange-600">
                      {formatPrecio(v.precio_oferta)}
                    </span>
                  </>
                ) : (
                  formatPrecio(v.precio)
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {otrasPizzas.length > 0 && (
        <ScrollReveal className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Otras pizzas populares
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {otrasPizzas.map((p) => (
              <Link
                key={p.id}
                href={`/menu/${p.slug}`}
                className="card-interactive rounded-lg border border-zinc-200 p-4 hover:border-brand-orange dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {p.nombre}
                </p>
              </Link>
            ))}
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
