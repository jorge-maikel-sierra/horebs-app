import type { Metadata } from 'next';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import ScrollReveal from '@/components/ScrollReveal';
import WhatsappCta from '@/components/WhatsappCta';

export const metadata: Metadata = {
  title: 'Contacto | Pizzería Horebs',
  description:
    'Dirección, horario y WhatsApp de Pizzería Horebs en Riohacha, La Guajira.',
  alternates: { canonical: '/contacto' },
};

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.92C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.12.24-3.75-.79-3.17-1.24-5.19-4.5-5.34-4.71-.16-.21-1.28-1.7-1.28-3.25 0-1.54.81-2.3 1.1-2.61.29-.32.63-.4.84-.4.21 0 .42 0 .6.01.2.01.46-.08.72.55.26.63.9 2.16.98 2.32.08.16.13.34.02.55-.1.21-.15.34-.3.52-.15.18-.32.4-.45.54-.15.15-.31.32-.13.62.18.31.79 1.31 1.71 2.12 1.18 1.05 2.16 1.38 2.47 1.53.31.16.5.13.68-.08.19-.21.79-.92 1-1.24.21-.31.42-.26.7-.16.29.1 1.8.85 2.11 1 .31.16.52.24.6.37.08.13.08.76-.16 1.44Z" />
    </svg>
  );
}

export default function ContactoPage() {
  const mensajeWhatsapp = whatsappUrl('¡Hola! Quiero hacer un pedido.');
  const urlMapa = `https://www.google.com/maps/search/?api=1&query=${NEGOCIO.latitud},${NEGOCIO.longitud}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="animate-fade-up text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-zinc-50">
        Contacto
      </h1>
      <p className="animate-fade-up delay-1 mt-2 text-zinc-600 dark:text-zinc-400">
        Escribinos, pasá por el local o mirá cómo llegar.
      </p>

      <div className="animate-fade-up delay-2 mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href={urlMapa}
          target="_blank"
          rel="noopener noreferrer"
          className="card-gradient card-interactive rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <span className="btn-gradient flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm">
            <PinIcon />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Dirección
          </p>
          <p className="mt-0.5 text-zinc-900 transition-colors hover:text-brand-orange dark:text-zinc-50">
            {NEGOCIO.direccion}
          </p>
        </a>

        <div className="card-gradient card-interactive rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <span className="btn-gradient flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm">
            <ClockIcon />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Horario
          </p>
          <p className="mt-0.5 text-zinc-900 dark:text-zinc-50">{NEGOCIO.horario}</p>
        </div>

        <WhatsappCta
          href={mensajeWhatsapp}
          className="card-gradient card-interactive rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
            <WhatsappIcon />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            WhatsApp
          </p>
          <p className="mt-0.5 text-zinc-900 transition-colors hover:text-brand-orange dark:text-zinc-50">
            {NEGOCIO.whatsapp}
          </p>
        </WhatsappCta>
      </div>

      <WhatsappCta
        href={mensajeWhatsapp}
        className="btn-press animate-fade-up delay-3 mt-6 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        <WhatsappIcon />
        Escribinos por WhatsApp
      </WhatsappCta>

      <ScrollReveal className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:shadow-black/30">
        <iframe
          title="Ubicación de Pizzería Horebs"
          src={NEGOCIO.mapaEmbedUrl}
          className="h-72 w-full"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </ScrollReveal>
    </div>
  );
}
