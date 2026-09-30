'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';
import EstadoVacio from '@/components/EstadoVacio';

function IconFlechaIzquierda() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}

function IconCarritoVacio() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}

function IconQuitar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function CarritoPage() {
  const { items, updateCantidad, removeItem, clear, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="animate-fade-up mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Carrito
        </h1>
        <EstadoVacio icon={<IconCarritoVacio />}>
          Todavía no agregaste nada. Mirá el{' '}
          <Link href="/catalogo" className="text-brand-orange underline">
            catálogo
          </Link>{' '}
          y elegí tu pizza.
        </EstadoVacio>
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
          className="btn-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300"
        >
          <IconFlechaIzquierda />
          Seguir comprando
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {items.map((item, i) => (
          <li
            key={item.varianteId}
            className="card-interactive card-gradient animate-fade-up rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800"
            style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {item.imagenUrl && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={item.imagenUrl}
                      alt={item.productoNombre}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {item.productoNombre}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {item.varianteNombre} — {formatPrecio(item.precio)} c/u
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
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

                <p className="w-20 shrink-0 text-right font-semibold sm:w-24">
                  {formatPrecio(item.precio * item.cantidad)}
                </p>

                <button
                  type="button"
                  onClick={() => removeItem(item.varianteId)}
                  aria-label={`Quitar ${item.productoNombre} ${item.varianteNombre} del carrito`}
                  className="btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:text-zinc-500 dark:hover:bg-danger-900/30 dark:hover:text-danger-400"
                >
                  <IconQuitar />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={clear}
        className="btn-press mt-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-danger-300 hover:bg-danger-50 hover:text-danger-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-danger-900 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
      >
        <IconQuitar />
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
        className="btn-press mt-6 block w-full rounded-lg btn-gradient py-3 text-center font-semibold text-white transition-opacity hover:opacity-90"
      >
        Continuar al checkout
      </Link>
    </div>
  );
}
