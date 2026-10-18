import type { ReactNode } from 'react';
import Link from 'next/link';
import { NEGOCIO, URL_COMO_LLEGAR, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import WhatsappCta from '@/components/WhatsappCta';
import EstadoAbierto from '@/components/hero/EstadoAbierto';

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-white/10 py-5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-[0.7rem] font-semibold tracking-[0.2em] text-brand-yellow-500 uppercase sm:pt-1">
        {etiqueta}
      </dt>
      <dd className="text-zinc-100">{children}</dd>
    </div>
  );
}

/**
 * Cierre de la home en el mismo navy del hero, para que la página quede
 * enmarcada: última invitación a pedir y los datos para hacerlo (horario
 * en vivo, dirección, domicilio y WhatsApp).
 */
export default function CierrePedido() {
  return (
    <section
      id="pedir"
      aria-labelledby="titulo-cierre"
      className="superficie-oscura relative overflow-hidden bg-brand-navy px-6 pt-24 pb-28 text-white sm:pt-32 sm:pb-36"
    >
      <div aria-hidden="true" className="hero-horno" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-brand-yellow-500 uppercase">
            Pide ahora
            <span aria-hidden="true" className="h-px w-8 bg-current opacity-60" />
          </p>
          <h2
            id="titulo-cierre"
            className="font-display mt-5 text-balance text-5xl leading-[1.02] sm:text-7xl"
          >
            ¿Se te <span className="texto-fuego">antojó</span>?
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-200">
            Pide online y te la llevamos a domicilio, o escríbenos por
            WhatsApp. Si prefieres, la retiras en el local.
          </p>
          <div className="mt-10 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/catalogo"
              className="btn-press btn-gradient rounded-full px-8 py-3.5 text-center font-semibold text-white shadow-lg shadow-black/30 transition hover:brightness-110"
            >
              Pedir online
            </Link>
            <WhatsappCta
              href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
              className="btn-press rounded-full border border-white/70 px-8 py-3.5 text-center font-semibold text-white transition hover:bg-white hover:text-brand-navy"
            >
              Pedir por WhatsApp
            </WhatsappCta>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-9">
            <EstadoAbierto />
            <dl className="mt-7">
              <Dato etiqueta="Horario">{NEGOCIO.horario}</Dato>
              <Dato etiqueta="Dirección">
                <p>{NEGOCIO.direccion}</p>
                <a
                  href={URL_COMO_LLEGAR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-yellow-500 underline-offset-4 hover:underline"
                >
                  Cómo llegar
                  <span aria-hidden="true">→</span>
                  <span className="sr-only"> (se abre en Google Maps)</span>
                </a>
              </Dato>
              <Dato etiqueta="Domicilio">
                {formatPrecio(NEGOCIO.costoDomicilio)} · retiro en el local sin costo
              </Dato>
              <Dato etiqueta="WhatsApp">
                <WhatsappCta
                  href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
                  className="font-semibold tabular-nums underline-offset-4 hover:underline"
                >
                  {NEGOCIO.whatsapp}
                </WhatsappCta>
              </Dato>
            </dl>
            <Link
              href="/contacto"
              className="mt-7 inline-block text-sm text-zinc-300 underline underline-offset-4 transition-colors hover:text-white"
            >
              Ver el mapa y todos los datos de contacto
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
