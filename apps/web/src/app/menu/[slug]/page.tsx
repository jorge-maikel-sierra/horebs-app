import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AgregarAlCarritoBoton from '@/components/AgregarAlCarritoBoton';
import { formatPrecio } from '@/lib/formato';
import { NEGOCIO } from '@/lib/negocio';

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion ?? undefined,
    image: producto.imagen_url ?? undefined,
    offers: producto.variantes.map((v) => ({
      '@type': 'Offer',
      name: v.nombre,
      price: String(v.precio_oferta ?? v.precio),
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
    })),
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <Link href="/catalogo" className="text-sm text-brand-orange underline">
        ← Volver al catálogo
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {producto.nombre} a domicilio en Riohacha
      </h1>

      {producto.imagen_url && (
        <div className="relative mt-6 h-72 w-full overflow-hidden rounded-xl sm:h-96">
          <Image
            src={producto.imagen_url}
            alt={altDescriptivo}
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {producto.descripcion && (
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          {producto.descripcion}
        </p>
      )}

      {producto.variantes.length > 0 && (
        <ul className="mt-6 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {producto.variantes.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3">
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
        <section className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Otras pizzas populares
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {otrasPizzas.map((p) => (
              <Link
                key={p.id}
                href={`/menu/${p.slug}`}
                className="rounded-lg border border-zinc-200 p-4 transition hover:border-brand-orange dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {p.nombre}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
