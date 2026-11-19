import type { ReactNode } from 'react';
import { formatPrecio } from '@/lib/formato';
import { COLOR_MARCA, type TonoGrafico } from '@/components/informes/GraficoColumnas';

export type FilaRanking = {
  clave: string;
  etiqueta: string;
  /** Texto secundario junto a la etiqueta, ej. el teléfono del cliente. */
  extra?: string;
  valor: number;
  detalle: ReactNode;
};

/**
 * Lista de barras horizontales: rankings numerados (productos, clientes) y
 * desgloses sin número (método de pago, categorías). Las barras se escalan
 * contra el mayor valor, no contra el total, para que el líder llene la fila.
 */
export default function RankingBarras({
  filas,
  tono,
  numerado = false,
  vacio,
}: {
  filas: FilaRanking[];
  tono: TonoGrafico;
  numerado?: boolean;
  vacio: string;
}) {
  if (filas.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{vacio}</p>;
  }
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const Lista = numerado ? 'ol' : 'ul';
  return (
    <Lista className="space-y-3">
      {filas.map((f, idx) => (
        <li key={f.clave} className={numerado ? 'flex items-center gap-3' : undefined}>
          {numerado && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-bold text-accent-ink">
              {idx + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span
                className={`truncate font-medium ${numerado ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                {f.etiqueta}
                {f.extra && (
                  <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {f.extra}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                {formatPrecio(f.valor)}
              </span>
            </div>
            <div
              className={`mt-1 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800 ${numerado ? 'h-1.5' : 'h-2'}`}
            >
              <div
                className={`h-full rounded-r-[4px] ${COLOR_MARCA[tono]}`}
                style={{ width: `${(f.valor / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{f.detalle}</span>
          </div>
        </li>
      ))}
    </Lista>
  );
}
