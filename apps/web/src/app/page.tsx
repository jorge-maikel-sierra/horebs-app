import Image from 'next/image';
import Link from 'next/link';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import PremiosSection from '@/components/PremiosSection';
import ClientesFelicesSection from '@/components/ClientesFelicesSection';
import FaqSection from '@/components/FaqSection';
import WhatsappCta from '@/components/WhatsappCta';
import BarraPedidoMovil from '@/components/BarraPedidoMovil';
import ScrollReveal from '@/components/ScrollReveal';
import BrasasHorno from '@/components/hero/BrasasHorno';
import EstadoAbierto from '@/components/hero/EstadoAbierto';
import PalabraRotativa from '@/components/hero/PalabraRotativa';
import ConjuroPizza from '@/components/hero/ConjuroPizza';
import TituloLetras from '@/components/hero/TituloLetras';
import { faqJsonLd, jsonLdScript } from '@/lib/json-ld';
import { FAQS } from '@/lib/faqs';

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
  // La foto del hero es la Especial: la etiqueta la enlaza a su ficha.
  const especial = destacados.find((p) => /especial/i.test(p.nombre));
  const precioEspecial = especial ? precioDesde(especial) : null;

  return (
    <div>
      <section
        id="inicio"
        aria-label="Inicio"
        className="superficie-oscura relative flex min-h-[100svh] items-center overflow-hidden bg-brand-navy px-6 py-8 text-white sm:py-20">
        <div className="hero-mesh" />
        <div aria-hidden="true" className="hero-horno" />
        <BrasasHorno retrasoMs={3200} />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-6 sm:gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
          <div className="relative z-10 order-2 text-center lg:order-1 lg:text-left">
            <div className="animate-fade-up">
              <EstadoAbierto />
            </div>
            <TituloLetras
              texto={NEGOCIO.nombre}
              destacar="Horebs"
              className="mt-4 text-[2.9rem] leading-none font-extrabold tracking-tight sm:mt-5 sm:text-6xl lg:text-7xl xl:text-8xl"
            />
            <p className="animate-fade-up delay-3 mt-3 text-xl font-bold sm:mt-4 sm:text-3xl">
              Pizza{' '}
              <PalabraRotativa
                palabras={[
                  'recién horneada',
                  'dorada y crocante',
                  'a domicilio',
                ]}
              />
            </p>
            <p className="animate-fade-up delay-4 mx-auto mt-3 max-w-xl text-base text-zinc-200 sm:mt-4 sm:text-lg lg:mx-0">
              Pizza artesanal hecha en Riohacha, con la masa crocante de
              siempre y bien cargada de queso. Pide online o directo por
              WhatsApp.
            </p>
            <div className="hero-ctas animate-fade-up mx-auto mt-6 flex max-w-xs flex-col items-stretch gap-3 sm:mt-8 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4 lg:justify-start">
              <Link
                href="/catalogo"
                className="btn-press btn-gradient rounded-lg px-6 py-3 text-center font-semibold text-white transition hover:brightness-110"
              >
                Pedir online
              </Link>
              <WhatsappCta
                href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
                className="btn-press rounded-lg border border-white px-6 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-brand-navy"
              >
                Pedir por WhatsApp
              </WhatsappCta>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <ConjuroPizza
              insignia={
                especial && (
                  <Link
                    href={especial.slug ? `/menu/${especial.slug}` : '/catalogo'}
                    className="btn-press block rounded-2xl border border-white/20 bg-brand-navy/80 px-3.5 py-1.5 text-left whitespace-nowrap shadow-xl backdrop-blur-md transition hover:border-brand-yellow/60 sm:px-4 sm:py-2.5"
                  >
                    <span className="block text-[0.65rem] font-bold tracking-widest text-brand-yellow uppercase sm:text-xs">
                      Firma de la casa
                    </span>
                    <span className="block text-sm font-bold text-white sm:text-base">
                      {especial.nombre}
                    </span>
                    {/* brand-orange-400 on purpose: this badge sits on navy in both themes (4.9:1). */}
                    {precioEspecial !== null && (
                      <span className="hidden text-sm font-semibold text-brand-orange-400 sm:block">
                        Desde {formatPrecio(precioEspecial)}
                      </span>
                    )}
                  </Link>
                )
              }
            />
          </div>
        </div>
      </section>

      {destacados.length > 0 && (
        <section aria-labelledby="titulo-firmas" className="mx-auto max-w-4xl px-6 py-12">
          <h2 id="titulo-firmas" className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Nuestras firmas de la casa
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {destacados.map((p, i) => {
              const desde = precioDesde(p);
              return (
                <Link
                  key={p.id}
                  href={p.slug ? `/menu/${p.slug}` : '/catalogo'}
                  className={`card-interactive card-gradient-featured group animate-fade-up overflow-hidden rounded-2xl border border-brand-orange/30 ${i % 2 === 1 ? 'delay-1' : ''}`}
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
                      <p className="mt-2 font-semibold text-accent-ink">
                        Desde {formatPrecio(desde)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/catalogo"
              className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-5 py-2.5 font-semibold text-zinc-900 transition-colors hover:border-accent-ink hover:text-accent-ink dark:border-zinc-700 dark:text-zinc-50"
            >
              Ver todo el menú
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}

      <ScrollReveal>
        <ClientesFelicesSection />
      </ScrollReveal>
      <ScrollReveal>
        <PremiosSection />
      </ScrollReveal>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQS)) }}
      />
      <ScrollReveal className="border-t border-zinc-200 dark:border-zinc-800">
        <FaqSection />
      </ScrollReveal>

      <ScrollReveal className="border-t border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">
          {NEGOCIO.direccion}
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{NEGOCIO.horario}</p>
        <Link
          href="/contacto"
          className="mt-3 inline-block text-sm font-medium text-accent-ink underline underline-offset-2 transition-colors hover:no-underline"
        >
          Ver mapa y datos de contacto
        </Link>
      </ScrollReveal>

      <BarraPedidoMovil idHero="inicio" />
    </div>
  );
}
