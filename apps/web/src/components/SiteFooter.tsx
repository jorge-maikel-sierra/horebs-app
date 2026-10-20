'use client';

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
  'btn-press objetivo-tactil flex h-10 w-10 items-center justify-center rounded-full bg-[var(--superficie)] text-zinc-700 transition-colors hover:bg-brand-orange-700 hover:text-white dark:text-zinc-300';

/**
 * El cierre de todas las páginas, de borde a borde: media pantalla con la
 * foto de la Especial en primer plano y, en la otra mitad, el menú del
 * sitio en letra grande, los datos para pedir y la línea legal.
 */
export default function SiteFooter() {
  const pathname = usePathname();
  // El año en hora de Colombia: el servidor corre en UTC y el 31 de
  // diciembre en la noche ya estaría en el año siguiente.
  const anio = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
  }).format(new Date());

  if (pathname?.startsWith('/admin')) return null;

  return (
    <footer className="grid bg-[var(--background)] lg:min-h-[80svh] lg:grid-cols-2">
      <div className="relative h-[50svh] overflow-hidden lg:h-auto">
        <Image
          src="/hero-pizza-especial.webp"
          alt="Una porción de la Pizza Horebs Especial con el queso estirándose"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="scale-[1.35] object-cover"
          style={{ objectPosition: '72% 32%' }}
        />
      </div>

      <div className="flex flex-col justify-between gap-14 px-[var(--margen)] pt-[clamp(3rem,6vw,5rem)] pb-[var(--margen)] lg:pl-[clamp(2rem,6vw,6rem)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/logo-horebs.png" alt="" width={40} height={40} className="h-10 w-10" />
            <span className="font-display text-xl text-zinc-900 dark:text-zinc-50">
              {NEGOCIO.nombre}
            </span>
          </Link>

          <nav aria-label="Pie de página" className="mt-10">
            <ul className="pie-menu space-y-2 text-[clamp(2rem,3.2vw,2.75rem)] leading-tight font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {ENLACES.map((enlace) => (
                <li key={enlace.href}>
                  <Link href={enlace.href}>{enlace.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="t-cuerpo grid gap-10 text-zinc-800 sm:grid-cols-2 dark:text-zinc-200">
          <address className="not-italic">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Visítanos</p>
            <p className="mt-2">{NEGOCIO.direccion}</p>
            <p>{NEGOCIO.horario}</p>
            <a
              href={URL_COMO_LLEGAR}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-semibold text-accent-ink underline decoration-2 underline-offset-4"
            >
              Cómo llegar
              <span className="sr-only"> (se abre en Google Maps)</span>
            </a>
          </address>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Pide por WhatsApp</p>
            <WhatsappCta
              href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
              className="mt-2 inline-block tabular-nums underline-offset-4 hover:text-accent-ink hover:underline"
            >
              {NEGOCIO.whatsapp}
            </WhatsappCta>
            <p>
              Domicilio {formatPrecio(NEGOCIO.costoDomicilio)}, o retíralo en el local sin costo.
            </p>
            <ul className="mt-4 flex items-center gap-3" aria-label="Redes sociales">
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
        </div>

        <div className="t-chico flex flex-col gap-2 text-zinc-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:text-zinc-400">
          <p>
            © {anio} {NEGOCIO.nombre}. Todos los derechos reservados.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/politica-privacidad"
              className="underline-offset-4 hover:text-accent-ink hover:underline"
            >
              Política de privacidad
            </Link>
            <span>
              Sitio desarrollado por{' '}
              <a
                href="https://jorge-sierra.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-800 underline-offset-4 hover:text-accent-ink hover:underline dark:text-zinc-200"
              >
                Jorge Maikel Sierra
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
