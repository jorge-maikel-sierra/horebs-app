import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconAlerta, IconCheck, IconFlechaDerecha } from './iconos';

/**
 * Tarjeta de "atención requerida": el estado va siempre en texto
 * ("Pendiente" / "Al día") además del color.
 */
export default function TarjetaAtencion({
  icono,
  etiqueta,
  valor,
  detalle,
  href,
  urgente,
  cargando = false,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: number | null;
  detalle: string;
  href: string;
  urgente: boolean;
  cargando?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card-gradient card-interactive group relative flex min-w-0 flex-col justify-between gap-3 overflow-hidden sm:gap-4 rounded-2xl border border-zinc-200 p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 sm:p-5 dark:border-zinc-800"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${
          cargando
            ? 'bg-zinc-200 dark:bg-zinc-800'
            : urgente
              ? 'bg-amber-500'
              : 'bg-green-500'
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            urgente
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400'
              : 'bg-brand-orange/15 text-accent-ink'
          }`}
        >
          {icono}
        </span>
        {!cargando && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              urgente
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
                : 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
            }`}
          >
            {urgente ? <IconAlerta /> : <IconCheck />}
            {urgente ? 'Pendiente' : 'Al día'}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] leading-tight font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {etiqueta}
        </p>
        <p className="mt-1 text-3xl leading-none sm:text-4xl font-extrabold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
          {cargando ? '…' : (valor ?? '—')}
        </p>
        <p className="mt-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {cargando ? 'Cargando…' : detalle}
        </p>
      </div>

      <span className="hidden items-center gap-1 text-xs font-semibold text-accent-ink transition-transform sm:flex group-hover:translate-x-0.5">
        Abrir
        <IconFlechaDerecha />
      </span>
    </Link>
  );
}
