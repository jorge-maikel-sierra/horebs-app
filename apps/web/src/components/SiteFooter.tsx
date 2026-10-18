'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NEGOCIO, URL_COMO_LLEGAR, whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';
import WhatsappCta from '@/components/WhatsappCta';

const ENLACES = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/carrito', label: 'Carrito' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/cuenta', label: 'Mi cuenta' },
];

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.92C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.12.24-3.75-.79-3.17-1.24-5.19-4.5-5.34-4.71-.16-.21-1.28-1.7-1.28-3.25 0-1.54.81-2.3 1.1-2.61.29-.32.63-.4.84-.4.21 0 .42 0 .6.01.2.01.46-.08.72.55.26.63.9 2.16.98 2.32.08.16.13.34.02.55-.1.21-.15.34-.3.52-.15.18-.32.4-.45.54-.15.15-.31.32-.13.62.18.31.79 1.31 1.71 2.12 1.18 1.05 2.16 1.38 2.47 1.53.31.16.5.13.68-.08.19-.21.79-.92 1-1.24.21-.31.42-.26.7-.16.29.1 1.8.85 2.11 1 .31.16.52.24.6.37.08.13.08.76-.16 1.44Z" />
    </svg>
  );
}

const REDES = [
  { href: NEGOCIO.facebook, label: 'Facebook', Icono: FacebookIcon },
  { href: NEGOCIO.instagram, label: 'Instagram', Icono: InstagramIcon },
] as const;

const claseRed =
  'btn-press objetivo-tactil flex h-10 w-10 items-center justify-center rounded-full border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] text-zinc-600 transition-colors hover:border-accent-ink hover:text-accent-ink dark:text-zinc-400';

function TituloColumna({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.25em] text-accent-ink uppercase">
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-current opacity-30" />
    </p>
  );
}

/**
 * La contraportada de la carta: misma superficie de papel/tinta con grano
 * que la home, cuatro columnas (marca, navegación, visita y pedido) y el
 * nombre de la casa en grande al pie, recortado como un sello.
 */
export default function SiteFooter() {
  const pathname = usePathname();
  const anio = new Date().getFullYear();

  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="carta overflow-hidden text-sm">
      <div aria-hidden="true" className="hilo-dorado" />

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-6 pt-16 pb-12 sm:gap-x-10 sm:pt-20 lg:grid-cols-12">
        <div className="col-span-2 min-w-0 lg:col-span-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo-horebs.png" alt="" width={44} height={44} className="h-11 w-11" />
            <span className="font-display text-2xl text-zinc-900 dark:text-zinc-50">
              {NEGOCIO.nombre}
            </span>
          </Link>
          <p className="mt-5 max-w-xs text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Pizza artesanal de masa crocante, recién horneada en Riohacha.
          </p>
          <ul className="mt-6 flex items-center gap-3" aria-label="Redes sociales">
            {REDES.map(({ href, label, Icono }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (se abre en una pestaña nueva)`}
                  className={claseRed}
                >
                  <Icono />
                </a>
              </li>
            ))}
            <li>
              <WhatsappCta
                href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
                ariaLabel="WhatsApp (se abre en una pestaña nueva)"
                className={claseRed}
              >
                <WhatsappIcon />
              </WhatsappCta>
            </li>
          </ul>
        </div>

        <nav aria-label="Pie de página" className="min-w-0 lg:col-span-2">
          <TituloColumna>La carta</TituloColumna>
          <ul className="mt-4 space-y-0.5">
            {ENLACES.map((enlace) => (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className="enlace-subrayado inline-block py-1.5 text-base text-zinc-700 transition-colors hover:text-accent-ink dark:text-zinc-300"
                >
                  {enlace.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 lg:col-span-3">
          <TituloColumna>Visítanos</TituloColumna>
          <address className="mt-5 space-y-4 text-base leading-7 text-zinc-700 not-italic dark:text-zinc-300">
            <p>{NEGOCIO.direccion}</p>
            <p>{NEGOCIO.horario}</p>
            <a
              href={URL_COMO_LLEGAR}
              target="_blank"
              rel="noopener noreferrer"
              className="enlace-subrayado inline-flex items-center gap-1.5 font-semibold text-accent-ink"
            >
              Cómo llegar
              <span aria-hidden="true">→</span>
              <span className="sr-only"> (se abre en Google Maps)</span>
            </a>
          </address>
        </div>

        <div className="col-span-2 min-w-0 lg:col-span-3">
          <TituloColumna>Pide</TituloColumna>
          <p className="mt-5 text-zinc-600 dark:text-zinc-400">Por WhatsApp</p>
          <WhatsappCta
            href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
            className="font-display mt-1 inline-block text-2xl text-zinc-900 tabular-nums transition-colors hover:text-accent-ink dark:text-zinc-50"
          >
            {NEGOCIO.whatsapp}
          </WhatsappCta>
          <p className="mt-4 leading-6 text-zinc-600 dark:text-zinc-400">
            Domicilio {formatPrecio(NEGOCIO.costoDomicilio)} · o retíralo en el
            local sin costo.
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[var(--carta-linea)] px-6 py-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
        <p>
          © {anio} {NEGOCIO.nombre}. Todos los derechos reservados.
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/politica-privacidad"
            className="enlace-subrayado transition-colors hover:text-accent-ink"
          >
            Política de privacidad
          </Link>
          <span>
            Sitio desarrollado por{' '}
            <a
              href="https://jorge-sierra.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="enlace-subrayado font-medium text-zinc-700 transition-colors hover:text-accent-ink dark:text-zinc-300"
            >
              Jorge Maikel Sierra
            </a>
          </span>
        </p>
      </div>

      {/* El nombre de la casa como sello al pie: decorativo, recortado por
          abajo y con el degradado del fuego del hero. */}
      <p
        aria-hidden="true"
        className="sello-pie font-display pointer-events-none -mb-[0.28em] text-center leading-[0.8] select-none"
      >
        Horebs
      </p>
    </footer>
  );
}
