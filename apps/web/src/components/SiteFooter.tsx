import Link from 'next/link';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';

const ENLACES = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/cuenta', label: 'Cuenta' },
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

export default function SiteFooter() {
  const anio = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 px-6 py-12 text-sm dark:border-zinc-800">
      <div className="mx-auto grid max-w-4xl gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {NEGOCIO.nombre}
          </p>
          <p className="mt-2 max-w-xs text-zinc-600 dark:text-zinc-400">
            Pizza artesanal, masa dorada y crujiente, recién horneada en
            Riohacha.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href={NEGOCIO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-400"
            >
              <FacebookIcon />
            </a>
            <a
              href={NEGOCIO.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-400"
            >
              <InstagramIcon />
            </a>
            <a
              href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-400"
            >
              <WhatsappIcon />
            </a>
          </div>
        </div>

        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            Explorar
          </p>
          <ul className="mt-3 space-y-2">
            {ENLACES.map((enlace) => (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className="text-zinc-600 transition-colors hover:text-brand-orange dark:text-zinc-400"
                >
                  {enlace.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            Contacto
          </p>
          <ul className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-400">
            <li>{NEGOCIO.direccion}</li>
            <li>{NEGOCIO.horario}</li>
            <li>
              <a
                href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-brand-orange"
              >
                {NEGOCIO.whatsapp}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-4xl border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>
          © {anio} {NEGOCIO.nombre}. Todos los derechos reservados.
        </p>
        <p className="mt-1">
          Sitio desarrollado por{' '}
          <a
            href="https://jorge-sierra.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-600 transition-colors hover:text-brand-orange dark:text-zinc-400"
          >
            Jorge Maikel Sierra
          </a>
        </p>
      </div>
    </footer>
  );
}
