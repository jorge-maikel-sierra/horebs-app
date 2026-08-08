import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import AgregarAlCarritoBoton from '@/components/AgregarAlCarritoBoton';
import { formatPrecio } from '@/lib/formato';

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
      className={`overflow-hidden rounded-lg border p-4 ${
        producto.destacado
          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {producto.imagen_url && (
        <div className="relative -mx-4 -mt-4 mb-3 h-40 w-[calc(100%+2rem)] overflow-hidden rounded-t-lg">
          <Image
            src={producto.imagen_url}
            alt={`${producto.nombre} a domicilio en Riohacha`}
            fill
            sizes="(min-width: 640px) 420px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      {producto.destacado && (
        <span className="mb-2 inline-block rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
          Firma de la casa
        </span>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {producto.slug ? (
          <Link href={`/menu/${producto.slug}`} className="hover:text-brand-orange">
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
        <ul className="mt-3 space-y-2 text-sm">
          {producto.variantes.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
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

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Catálogo
      </h1>

      {destacados.length > 0 && (
        <section className="mt-6">
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
          <section key={categoria.id} className="mt-8">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {categoria.nombre}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {productosCategoria.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
