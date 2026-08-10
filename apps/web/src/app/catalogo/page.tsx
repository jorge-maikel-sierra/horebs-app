import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import AgregarAlCarritoBoton from '@/components/AgregarAlCarritoBoton';
import ScrollReveal from '@/components/ScrollReveal';
import { formatPrecio } from '@/lib/formato';
import { breadcrumbJsonLd, jsonLdScript } from '@/lib/json-ld';
import { NEGOCIO } from '@/lib/negocio';

export const metadata: Metadata = {
  title: 'Catálogo | Pizzería Horebs',
  description:
    'Pizzas, panzerottis y bebidas de Pizzería Horebs en Riohacha. Pedí en línea con entrega a domicilio o retiro en el local.',
  alternates: { canonical: '/catalogo' },
};

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
  destacado: boolean;
  categoria_id: string;
  slug: string | null;
  variantes: Variante[];
};

type Categoria = { id: string; nombre: string; orden: number };

async function getCategorias(): Promise<Categoria[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/catalogo/categorias`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

async function getProductos(): Promise<Producto[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/catalogo/productos`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

function ProductoCard({ producto }: { producto: Producto }) {
  return (
    <div
      className={`card-interactive group overflow-hidden rounded-2xl border p-4 ${
        producto.destacado
          ? 'card-gradient-featured border-brand-orange/30'
          : 'card-gradient border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {producto.imagen_url && (
        <div className="relative -mx-4 -mt-4 mb-3 h-40 w-[calc(100%+2rem)] overflow-hidden rounded-t-2xl">
          <Image
            src={producto.imagen_url}
            alt={`${producto.nombre} a domicilio en Riohacha`}
            fill
            sizes="(min-width: 640px) 420px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      )}
      {producto.destacado && (
        <span className="btn-gradient mb-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
          Firma de la casa
        </span>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {producto.slug ? (
          <Link
            href={`/menu/${producto.slug}`}
            className="transition-colors hover:text-brand-orange"
          >
            {producto.nombre}
          </Link>
        ) : (
          producto.nombre
        )}
      </h3>
      {producto.descripcion && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {producto.descripcion}
        </p>
      )}
      {producto.variantes.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-200/70 border-t border-zinc-200/70 text-sm dark:divide-zinc-800/70 dark:border-zinc-800/70">
          {producto.variantes.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-2">
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
    </div>
  );
}

export default async function CatalogoPage() {
  const [categorias, productos] = await Promise.all([
    getCategorias(),
    getProductos(),
  ]);

  if (productos.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Catálogo
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Todavía no hay productos cargados en el catálogo.
        </p>
      </div>
    );
  }

  const destacados = productos.filter((p) => p.destacado);
  const resto = productos.filter((p) => !p.destacado);

  const breadcrumbLd = breadcrumbJsonLd([
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Catálogo', ruta: '/catalogo' },
  ]);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: productos
      .filter((p) => p.slug)
      .map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://${NEGOCIO.sitio}/menu/${p.slug}`,
        name: p.nombre,
      })),
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListLd) }}
      />

      <h1 className="animate-fade-up text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Catálogo
      </h1>

      {destacados.length > 0 && (
        <section className="animate-fade-up delay-1 mt-6">
          <h2 className="text-xl font-semibold text-orange-600">
            Nuestras firmas de la casa
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {destacados.map((p) => (
              <ProductoCard key={p.id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {categorias.map((categoria) => {
        const productosCategoria = resto.filter(
          (p) => p.categoria_id === categoria.id,
        );
        if (productosCategoria.length === 0) return null;

        return (
          <ScrollReveal key={categoria.id} className="mt-8">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {categoria.nombre}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {productosCategoria.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
