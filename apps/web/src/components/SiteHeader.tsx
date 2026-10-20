'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import ThemeToggle from './ThemeToggle';

const NAV_LINKS = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/cuenta', label: 'Cuenta' },
];

export default function SiteHeader() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) return null;

  const etiquetaConteo = `${count} ${count === 1 ? 'producto' : 'productos'}`;

  return (
    <header className="sticky top-0 z-30 bg-[var(--background)]">
      <div className="flex h-[var(--alto-header)] items-center justify-between gap-4 px-[var(--margen)]">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-current={pathname === '/' ? 'page' : undefined}
        >
          <Image
            src="/logo-horebs.png"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 sm:h-10 sm:w-10"
            priority
          />
          <span className="font-display text-lg leading-none text-zinc-900 sm:text-xl dark:text-zinc-50">
            Pizzería Horebs
          </span>
        </Link>

        <nav aria-label="Principal" className="t-cuerpo hidden items-center gap-6 font-medium whitespace-nowrap text-zinc-700 lg:flex dark:text-zinc-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
              className="transition-colors hover:text-accent-ink aria-[current=page]:text-accent-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/carrito"
            className="flex items-center gap-1.5 transition-colors hover:text-accent-ink"
          >
            Carrito
            {count > 0 && (
              <span
                key={count}
                aria-hidden="true"
                className="animate-badge-bump flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange-700 text-xs font-semibold text-white"
              >
                {count}
              </span>
            )}
            {count > 0 && <span className="sr-only">, {etiquetaConteo}</span>}
          </Link>
          <ThemeToggle />
          <Link
            href="/catalogo"
            className="btn-press rounded-full bg-brand-orange-700 px-5 py-2 font-semibold text-white transition-colors hover:bg-brand-orange-800"
          >
            Pedir
          </Link>
        </nav>

        <div className="flex items-center gap-1 lg:hidden">
          <Link
            href="/catalogo"
            className="btn-press mr-1 rounded-full bg-brand-orange-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-800"
          >
            Pedir
          </Link>
          <Link
            href="/carrito"
            aria-label={count > 0 ? `Carrito, ${etiquetaConteo}` : 'Carrito'}
            className="relative objetivo-tactil flex h-9 w-9 items-center justify-center text-zinc-700 transition-colors hover:text-accent-ink dark:text-zinc-300"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {count > 0 && (
              <span
                key={count}
                aria-hidden="true"
                className="animate-badge-bump absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange-700 text-[10px] font-semibold text-white"
              >
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="menu-movil"
            className="btn-press objetivo-tactil flex h-9 w-9 items-center justify-center text-zinc-700 dark:text-zinc-300"
          >
            {open ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="animate-fade-up bg-[var(--background)] px-[var(--margen)] pt-2 pb-5 lg:hidden">
          <ul className="flex flex-col gap-1 text-base font-medium text-zinc-700 dark:text-zinc-300">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 transition-colors hover:text-accent-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
