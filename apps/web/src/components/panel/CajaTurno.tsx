import { formatPrecio } from '@/lib/formato';

const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

// Tres pasos categóricos validados con validate_palette.js (--pairs all, claro
// y oscuro). El aqua claro queda bajo 3:1 contra la superficie: por eso cada
// segmento va con leyenda y valor visibles, nunca solo con color.
const METODOS = [
  {
    clave: 'efectivo',
    etiqueta: 'Efectivo',
    color: 'bg-[#eb6834] dark:bg-[#d95926]',
  },
  {
    clave: 'transferencia',
    etiqueta: 'Transferencia',
    color: 'bg-[#2a78d6] dark:bg-[#3987e5]',
  },
  {
    clave: 'tarjeta',
    etiqueta: 'Tarjeta',
    color: 'bg-[#1baf7a] dark:bg-[#199e70]',
  },
] as const;

export type MontosCaja = {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
};

export default function CajaTurno({ montos }: { montos: MontosCaja }) {
  const total = montos.efectivo + montos.transferencia + montos.tarjeta;
  const resumen = METODOS.map(
    (m) => `${m.etiqueta} ${formatPrecio(montos[m.clave])}`,
  ).join(', ');

  return (
    <div>
      <p className="text-3xl font-extrabold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
        {formatPrecio(total)}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        vendido en el turno
      </p>

      {total > 0 ? (
        <div
          role="img"
          aria-label={`Reparto por método de pago: ${resumen}`}
          className="mt-4 flex h-3.5 gap-0.5 overflow-hidden rounded-full"
        >
          {METODOS.filter((m) => montos[m.clave] > 0).map((m) => (
            <span
              key={m.clave}
              className={`${m.color} rounded-[3px] first:rounded-l-full last:rounded-r-full`}
              style={{ flexGrow: montos[m.clave], flexBasis: 0 }}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
          Todavía no hay ventas en este turno.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {METODOS.map((m) => {
          const valor = montos[m.clave];
          return (
            <li key={m.clave} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-sm ${m.color}`}
              />
              <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                {m.etiqueta}
              </span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatPrecio(valor)}
              </span>
              <span className="w-10 text-right text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {total > 0 ? `${PCT.format((valor / total) * 100)} %` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
