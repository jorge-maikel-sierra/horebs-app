'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';

export default function CarritoPage() {
  const { items, updateCantidad, removeItem, clear, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="animate-fade-up mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Carrito
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Todavía no agregaste nada. Mirá el{' '}
          <Link href="/catalogo" className="text-brand-orange underline">
            catálogo
          </Link>{' '}
          y elegí tu pizza.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="animate-fade-up flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Carrito
        </h1>
        <Link
          href="/catalogo"
          className="text-sm text-brand-orange underline transition-colors hover:text-brand-orange/80"
        >
          Seguir comprando
        </Link>
      </div>

      <ul className="mt-6 space-y-4">
        {items.map((item, i) => (
          <li
            key={item.varianteId}
            className="animate-fade-up rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {item.productoNombre}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {item.varianteNombre} — {formatPrecio(item.precio)} c/u
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(item.varianteId)}
                  className="mt-1 text-xs text-red-600 transition-colors hover:underline"
                >
                  Quitar
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateCantidad(item.varianteId, item.cantidad - 1)
                    }
                    className="btn-press h-7 w-7 rounded-full border border-zinc-300 text-sm font-semibold transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700"
                    aria-label={`Restar unidad de ${item.productoNombre} ${item.varianteNombre}`}
                  >
                    −
                  </button>
                  <span key={item.cantidad} className="animate-pop-in w-6 text-center">
                    {item.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateCantidad(item.varianteId, item.cantidad + 1)
                    }
                    className="btn-press h-7 w-7 rounded-full border border-zinc-300 text-sm font-semibold transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700"
                    aria-label={`Sumar unidad de ${item.productoNombre} ${item.varianteNombre}`}
                  >
                    +
                  </button>
                </div>

                <p className="font-semibold sm:w-24 sm:text-right">
                  {formatPrecio(item.precio * item.cantidad)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={clear}
        className="mt-3 text-sm text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400"
      >
        Vaciar carrito
      </button>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <span className="text-lg font-semibold">Total</span>
        <span key={total} className="animate-pop-in text-lg font-bold text-brand-orange">
          {formatPrecio(total)}
        </span>
      </div>

      <Link
        href="/checkout"
        className="btn-press mt-6 block w-full rounded-lg bg-brand-orange py-3 text-center font-semibold text-white transition-opacity hover:opacity-90"
      >
        Continuar al checkout
      </Link>
    </div>
  );
}
