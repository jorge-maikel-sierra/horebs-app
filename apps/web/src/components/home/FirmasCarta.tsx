import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { formatPrecio } from '@/lib/formato';
import { TAMANOS } from '@/lib/tamanos';
import ScrollReveal from '@/components/ScrollReveal';

export type ProductoDestacado = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  slug: string | null;
  variantes: {
    id?: string;
    nombre?: string;
    precio: number;
    precio_oferta: number | null;
  }[];
};

export function precioDesde(producto: ProductoDestacado): number | null {
  if (producto.variantes.length === 0) return null;
  return Math.min(...producto.variantes.map((v) => v.precio_oferta ?? v.precio));
}

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

function Firma({ producto, indice }: { producto: ProductoDestacado; indice: number }) {
  const numero = String(indice + 1).padStart(2, '0');
  const href = producto.slug ? `/menu/${producto.slug}` : '/catalogo';
  const desde = precioDesde(producto);
  const invertida = indice % 2 === 1;
  const idTitulo = `firma-${producto.id}`;
  // Las variantes llegan en el orden de la base; se muestran de menor a
  // mayor precio, que es como se lee una carta.
  const variantes = [...producto.variantes].sort(
    (a, b) => (a.precio_oferta ?? a.precio) - (b.precio_oferta ?? b.precio),
  );

  return (
    <ScrollReveal>
      <article
        aria-labelledby={idTitulo}
        className="firma grid items-center gap-12 lg:grid-cols-12 lg:gap-16"
      >
        <div
          className={`escalon relative mx-auto w-full max-w-[19rem] sm:max-w-[22rem] lg:col-span-5 lg:max-w-none ${
            invertida ? 'lg:order-2' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`numeral-hueco font-display pointer-events-none absolute -top-14 z-0 text-[7.5rem] leading-none select-none sm:-top-20 sm:text-[10rem] ${
              invertida ? '-right-4 sm:-right-10' : '-left-4 sm:-left-10'
            }`}
          >
            {numero}
          </span>
          {/* Segundo arco desplazado: da profundidad sin otra sombra más. */}
          <div
            aria-hidden="true"
            className={`arco absolute inset-0 translate-y-4 border border-brand-orange-500/30 ${
              invertida ? '-translate-x-4' : 'translate-x-4'
            }`}
          />
          <div className="arco arco-marco relative z-10 shadow-2xl shadow-brand-orange-900/20 dark:shadow-black/60">
            <div className="arco relative aspect-[4/5] overflow-hidden bg-zinc-900">
              {producto.imagen_url && (
                <Image
                  src={producto.imagen_url}
                  alt={`${producto.nombre} a domicilio en Riohacha`}
                  fill
                  sizes="(min-width: 1024px) 400px, (min-width: 640px) 352px, 304px"
                  className="firma-foto object-cover"
                />
              )}
            </div>
          </div>
          {desde !== null && (
            <p
              className={`absolute -bottom-6 z-20 flex h-24 w-24 -rotate-6 flex-col items-center justify-center rounded-full bg-brand-navy text-center text-white shadow-xl ring-1 ring-brand-yellow-500/60 ring-offset-4 ring-offset-[var(--carta-fondo)] sm:h-28 sm:w-28 ${
                invertida ? '-left-3 sm:-left-5' : '-right-3 sm:-right-5'
              }`}
            >
              <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-brand-yellow-500 uppercase">
                Desde
              </span>
              <span className="font-display text-lg leading-tight sm:text-xl">
                {formatPrecio(desde)}
              </span>
            </p>
          )}
        </div>

        <div className={`lg:col-span-7 ${invertida ? 'lg:order-1' : ''}`}>
          <p
            style={escalon(1)}
            className="escalon flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-accent-ink uppercase"
          >
            <span>N.º {numero}</span>
            <span aria-hidden="true" className="h-px w-10 bg-current opacity-50" />
            <span>Firma de la casa</span>
          </p>
          <h3
            id={idTitulo}
            style={escalon(2)}
            className="escalon font-display mt-4 text-balance text-4xl leading-[1.05] text-zinc-900 sm:text-5xl dark:text-zinc-50"
          >
            {producto.nombre}
          </h3>
          {producto.descripcion && (
            <p
              style={escalon(3)}
              className="escalon mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400"
            >
              {producto.descripcion}
            </p>
          )}

          {variantes.length > 0 && (
            <dl style={escalon(4)} className="escalon mt-8 max-w-xl space-y-4">
              {variantes.map((v, i) => {
                const tamano = v.nombre ? TAMANOS[v.nombre] : undefined;
                return (
                  <div key={v.id ?? i} className="flex items-baseline">
                    <dt className="shrink-0">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {v.nombre ?? 'Precio'}
                      </span>
                      {tamano && (
                        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {tamano.porciones} porciones · {tamano.cm} cm
                        </span>
                      )}
                    </dt>
                    <span aria-hidden="true" className="puntos-guia" />
                    <dd className="font-display shrink-0 text-xl text-zinc-900 tabular-nums dark:text-zinc-50">
                      {v.precio_oferta !== null ? (
                        <>
                          <span className="sr-only">Antes </span>
                          <s className="mr-2 font-sans text-sm text-zinc-500 dark:text-zinc-400">
                            {formatPrecio(v.precio)}
                          </s>
                          <span className="sr-only">, ahora </span>
                          <span className="text-accent-ink">{formatPrecio(v.precio_oferta)}</span>
                        </>
                      ) : (
                        formatPrecio(v.precio)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          <div style={escalon(5)} className="escalon mt-10">
            <Link
              href={href}
              className="btn-press btn-gradient group/cta inline-flex items-center gap-3 rounded-full py-3.5 pr-3.5 pl-7 font-semibold text-white shadow-lg shadow-brand-orange-700/25 transition hover:brightness-110"
            >
              Pedir esta pizza
              <span className="sr-only">: {producto.nombre}</span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 group-hover/cta:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </article>
    </ScrollReveal>
  );
}

/**
 * Las firmas de la casa como páginas de una carta: foto en el arco dorado
 * de la lámpara del hero, sello de precio, número grande en serif y la
 * lista de tamaños con puntos guía.
 */
export default function FirmasCarta({ productos }: { productos: ProductoDestacado[] }) {
  if (productos.length === 0) return null;

  return (
    <section aria-labelledby="titulo-firmas" className="px-6 pt-24 pb-28 sm:pt-32">
      <header className="mx-auto max-w-2xl text-center">
        <p className="flex items-center justify-center gap-3 text-xs font-semibold tracking-[0.25em] text-accent-ink uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
          La carta de la casa
          <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
        </p>
        <h2
          id="titulo-firmas"
          className="font-display mt-5 text-balance text-4xl leading-[1.05] text-zinc-900 sm:text-6xl dark:text-zinc-50"
        >
          Nuestras firmas de la casa
        </h2>
        <p className="mt-5 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Las dos pizzas que definen a Horebs. Elige el tamaño y pídela a
          domicilio o para retirar en el local.
        </p>
      </header>

      <div className="mx-auto mt-24 max-w-6xl space-y-32 sm:mt-28 sm:space-y-40">
        {productos.map((p, i) => (
          <Firma key={p.id} producto={p} indice={i} />
        ))}
      </div>

      <div className="mx-auto mt-24 flex max-w-6xl flex-col items-center gap-6 sm:mt-32">
        <div aria-hidden="true" className="hilo-dorado w-full max-w-md" />
        <Link
          href="/catalogo"
          className="btn-press group inline-flex items-center gap-2 rounded-full border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] px-6 py-3 font-semibold text-zinc-900 transition-colors hover:border-accent-ink hover:text-accent-ink dark:text-zinc-50"
        >
          Ver todo el menú
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
