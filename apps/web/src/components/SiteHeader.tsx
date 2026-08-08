'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function SiteHeader() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold text-brand-orange">
          Pizzería Horebs
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Link href="/catalogo" className="hover:text-brand-orange">
            Catálogo
          </Link>
          <Link href="/contacto" className="hover:text-brand-orange">
            Contacto
          </Link>
          <Link href="/carrito" className="relative hover:text-brand-orange">
            Carrito
            {count > 0 && (
              <span className="absolute -right-4 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-orange text-xs font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
