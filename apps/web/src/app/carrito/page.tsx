'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precio);
}

export default function CarritoPage() {
  const { items, updateCantidad, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
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
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Carrito
      </h1>

      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li
            key={item.varianteId}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
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
                className="mt-1 text-xs text-red-600 hover:underline"
              >
                Quitar
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCantidad(item.varianteId, item.cantidad - 1)}
                className="h-7 w-7 rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
                aria-label={`Restar unidad de ${item.productoNombre} ${item.varianteNombre}`}
              >
                −
              </button>
              <span className="w-6 text-center">{item.cantidad}</span>
              <button
                type="button"
                onClick={() => updateCantidad(item.varianteId, item.cantidad + 1)}
                className="h-7 w-7 rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
                aria-label={`Sumar unidad de ${item.productoNombre} ${item.varianteNombre}`}
              >
                +
              </button>
            </div>

            <p className="w-24 text-right font-semibold">
              {formatPrecio(item.precio * item.cantidad)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-lg font-bold text-brand-orange">
          {formatPrecio(total)}
        </span>
      </div>

      <Link
        href="/checkout"
        className="mt-6 block w-full rounded-lg bg-brand-orange py-3 text-center font-semibold text-white transition hover:opacity-90"
      >
        Continuar al checkout
      </Link>
    </div>
  );
}
