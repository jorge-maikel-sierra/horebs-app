import Image from 'next/image';
import Link from 'next/link';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import PremiosSection from '@/components/PremiosSection';
import ClientesFelicesSection from '@/components/ClientesFelicesSection';
import ScrollReveal from '@/components/ScrollReveal';

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  slug: string | null;
  variantes: { precio: number; precio_oferta: number | null }[];
};

async function getDestacados(): Promise<Producto[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/catalogo/productos?destacado=true`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

function precioDesde(producto: Producto): number | null {
  if (producto.variantes.length === 0) return null;
  return Math.min(
    ...producto.variantes.map((v) => v.precio_oferta ?? v.precio),
  );
}

export default async function Home() {
  const destacados = await getDestacados();

  return (
    <div>
      <section className="bg-brand-navy px-6 py-16 text-center text-white">
        <h1 className="animate-fade-up text-4xl font-extrabold sm:text-5xl">
          {NEGOCIO.nombre}
        </h1>
        <p className="animate-fade-up delay-1 mx-auto mt-4 max-w-xl text-lg text-zinc-200">
          Pizza artesanal, masa dorada y crujiente, recién horneada en
          Riohacha. Pedí online o directo por WhatsApp.
        </p>
        <div className="animate-fade-up delay-2 mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/catalogo"
            className="btn-press rounded-lg bg-brand-orange px-6 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Ver catálogo
          </Link>
          <a
            href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press rounded-lg border border-white px-6 py-3 font-semibold text-white transition hover:bg-white hover:text-brand-navy"
          >
            Pedir por WhatsApp
          </a>
        </div>
      </section>

      {destacados.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-12">
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Nuestras firmas de la casa
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {destacados.map((p, i) => {
              const desde = precioDesde(p);
              return (
                <Link
                  key={p.id}
                  href={p.slug ? `/menu/${p.slug}` : '/catalogo'}
                  className={`card-interactive group animate-fade-up overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 ${i % 2 === 1 ? 'delay-1' : ''}`}
                >
                  {p.imagen_url && (
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={p.imagen_url}
                        alt={`${p.nombre} a domicilio en Riohacha`}
                        fill
                        sizes="(min-width: 640px) 420px, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {p.nombre}
                    </h3>
                    {p.descripcion && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {p.descripcion}
                      </p>
                    )}
                    {desde !== null && (
                      <p className="mt-2 font-semibold text-brand-orange">
                        Desde {formatPrecio(desde)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <ScrollReveal>
        <ClientesFelicesSection />
      </ScrollReveal>
      <ScrollReveal>
        <PremiosSection />
      </ScrollReveal>

      <ScrollReveal className="border-t border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">
          {NEGOCIO.direccion}
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{NEGOCIO.horario}</p>
        <Link
          href="/contacto"
          className="mt-3 inline-block text-sm text-brand-orange underline transition-colors hover:text-brand-orange/80"
        >
          Más datos de contacto
        </Link>
      </ScrollReveal>
    </div>
  );
}
