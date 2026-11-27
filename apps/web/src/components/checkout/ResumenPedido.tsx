import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';

function Linea({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'descuento' }) {
  return (
    <div
      className={`flex justify-between gap-3 py-1 tabular-nums ${
        tono === 'descuento' ? 'text-success-700 dark:text-success-400' : 'text-zinc-600 dark:text-zinc-400'
      }`}
    >
      <span>{etiqueta}</span>
      <span className="shrink-0">{valor}</span>
    </div>
  );
}

/**
 * Lo que se va a pagar, con el domicilio como línea propia: el API lo suma
 * al pedido (costoDomicilioDeCheckout), así que el total de acá tiene que
 * sumarlo también o el cliente ve una cifra y le cobran otra.
 */
export default function ResumenPedido({
  items,
  subtotal,
  domicilio,
  total,
}: {
  items: CartItem[];
  subtotal: number;
  /** 0 cuando es retiro en el local. */
  domicilio: number;
  total: number;
}) {
  return (
    <section
      aria-labelledby="titulo-resumen"
      className="card-gradient rounded-2xl border border-zinc-200 p-4 text-sm sm:p-5 dark:border-zinc-800"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-resumen" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Tu pedido
        </h2>
        <Link
          href="/carrito"
          className="-my-2 inline-flex h-11 items-center rounded-lg px-2 text-sm font-semibold text-accent-ink hover:bg-brand-orange/10"
        >
          Editar
        </Link>
      </div>

      <ul className="mt-2">
        {items.map((i) => (
          <li key={i.varianteId} className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex min-w-0 items-center gap-3">
              {i.imagenUrl ? (
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <Image src={i.imagenUrl} alt="" fill sizes="44px" className="object-cover" />
                </span>
              ) : null}
              <span className="min-w-0 text-zinc-800 dark:text-zinc-200">
                <span className="line-clamp-2 [overflow-wrap:anywhere]">
                  <span className="font-semibold tabular-nums">{i.cantidad}×</span> {i.productoNombre}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{i.varianteNombre}</span>
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatPrecio(i.precio * i.cantidad)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        <Linea etiqueta="Subtotal" valor={formatPrecio(subtotal)} />
        {domicilio > 0 && <Linea etiqueta="Domicilio" valor={formatPrecio(domicilio)} />}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total a pagar</span>
        <span className="text-xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
          {formatPrecio(total)}
        </span>
      </div>
    </section>
  );
}
