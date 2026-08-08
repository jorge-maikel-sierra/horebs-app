'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function SiteHeader() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
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
        <nav className="flex items-center gap-3 text-xs font-medium whitespace-nowrap text-zinc-700 sm:gap-5 sm:text-sm dark:text-zinc-300">
          <Link href="/catalogo" className="hover:text-brand-orange">
            Catálogo
          </Link>
          <Link href="/contacto" className="hover:text-brand-orange">
            Contacto
          </Link>
          <Link href="/cuenta" className="hover:text-brand-orange">
            Cuenta
          </Link>
          <Link
            href="/carrito"
            className="flex items-center gap-1.5 hover:text-brand-orange"
          >
            Carrito
            {count > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-xs font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
