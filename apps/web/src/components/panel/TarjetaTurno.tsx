import Link from 'next/link';
import { formatHora, formatPrecio } from '@/lib/formato';
import { IconFlechaDerecha, IconReloj } from './iconos';

/** Estado del turno de caja: abierto (con lo vendido) o sin abrir. */
export default function TarjetaTurno({
  cargando,
  fallo,
  abiertoEn,
  totalVentas,
}: {
  cargando: boolean;
  fallo: boolean;
  abiertoEn: string | null;
  totalVentas: number;
}) {
  const abierto = abiertoEn !== null;
  return (
    <Link
      href="/admin/pos"
      className="card-gradient card-interactive group flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-zinc-200 p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 sm:p-5 dark:border-zinc-800"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange-700 dark:text-brand-orange">
          <IconReloj />
        </span>
        {!cargando && !fallo && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${
              abierto
                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                abierto
                  ? 'bg-green-600 motion-safe:animate-pulse dark:bg-green-400'
                  : 'border border-zinc-500 dark:border-zinc-400'
              }`}
            />
            {abierto ? 'Abierto' : 'Cerrado'}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] leading-tight font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Turno de caja
        </p>
        <p className="mt-1 [overflow-wrap:anywhere] text-xl font-extrabold tracking-tight tabular-nums text-zinc-900 sm:text-2xl dark:text-zinc-50">
          {cargando
            ? '…'
            : fallo
              ? 'Sin datos'
              : abierto
                ? formatPrecio(totalVentas)
                : 'Sin turno'}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {cargando
            ? 'Cargando…'
            : fallo
              ? 'No se pudo cargar el turno'
              : abierto
                ? `Vendido desde las ${formatHora(abiertoEn)}`
                : 'No hay un turno abierto ahora'}
        </p>
      </div>

      <span className="flex items-center gap-1 text-xs font-semibold text-brand-orange-700 transition-transform group-hover:translate-x-0.5 dark:text-brand-orange">
        {abierto ? 'Ir al punto de venta' : 'Abrir turno'}
        <IconFlechaDerecha />
      </span>
    </Link>
  );
}
