import Link from 'next/link';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import ClientesFelicesSection from '@/components/ClientesFelicesSection';
import FaqSection from '@/components/FaqSection';
import WhatsappCta from '@/components/WhatsappCta';
import BarraPedidoMovil from '@/components/BarraPedidoMovil';
import FirmasCarta, {
  precioDesde,
  type ProductoDestacado,
} from '@/components/home/FirmasCarta';
import CierrePedido from '@/components/home/CierrePedido';
import ScrollReveal from '@/components/ScrollReveal';
import BrasasHorno from '@/components/hero/BrasasHorno';
import EstadoAbierto from '@/components/hero/EstadoAbierto';
import PalabraRotativa from '@/components/hero/PalabraRotativa';
import ConjuroPizza from '@/components/hero/ConjuroPizza';
import TituloLetras from '@/components/hero/TituloLetras';
import { faqJsonLd, jsonLdScript } from '@/lib/json-ld';
import { FAQS } from '@/lib/faqs';

async function getDestacados(): Promise<ProductoDestacado[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/catalogo/productos?destacado=true`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
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
                    {/* brand-orange-400 a propósito: la insignia va sobre navy en los dos temas (4.9:1). */}
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

      {/* Todo lo de abajo del hero es "la carta de la casa": papel cálido en
          claro, tinta de horno en oscuro, con grano encima. */}
      <div className="carta">
        <FirmasCarta productos={destacados} />
        <ScrollReveal>
          <ClientesFelicesSection />
        </ScrollReveal>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQS)) }}
        />
        <ScrollReveal>
          <FaqSection />
        </ScrollReveal>
      </div>

      <CierrePedido />

      <BarraPedidoMovil ocultarEn={['inicio', 'pedir']} />
    </div>
  );
}
