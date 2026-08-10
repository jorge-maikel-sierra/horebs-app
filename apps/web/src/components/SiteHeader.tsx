'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-horebs.png"
            alt="Pizzería Horebs"
            width={40}
            height={40}
            className="h-9 w-9 sm:h-10 sm:w-10"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium whitespace-nowrap text-zinc-700 sm:flex dark:text-zinc-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-brand-orange"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/carrito"
            className="flex items-center gap-1.5 transition-colors hover:text-brand-orange"
          >
            Carrito
            {count > 0 && (
              <span
                key={count}
                className="animate-badge-bump flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-xs font-semibold text-white"
              >
                {count}
              </span>
            )}
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 sm:hidden">
          <Link
            href="/carrito"
            aria-label="Carrito"
            className="relative flex h-9 w-9 items-center justify-center text-zinc-700 transition-colors hover:text-brand-orange dark:text-zinc-300"
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
                className="animate-badge-bump absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange text-[10px] font-semibold text-white"
              >
                {count}
              </span>
            )}
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            className="btn-press flex h-9 w-9 items-center justify-center text-zinc-700 dark:text-zinc-300"
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
        <nav className="animate-fade-up border-t border-zinc-200 px-4 py-3 sm:hidden dark:border-zinc-800">
          <ul className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 transition-colors hover:bg-zinc-50 hover:text-brand-orange dark:hover:bg-zinc-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
