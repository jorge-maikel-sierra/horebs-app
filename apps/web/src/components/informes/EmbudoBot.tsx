import type { InformeBot } from '@/components/informes/informes.tipos';

const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

function pct(parte: number, total: number) {
  return total > 0 ? `${PCT.format((parte / total) * 100)}%` : '—';
}

/**
 * Embudo de conversación → pedido → entrega. El largo de cada barra es
 * relativo al primer paso; entre pasos va la conversión de uno al siguiente,
 * que es lo que el dueño quiere mover. Cancelados y derivaciones son fugas,
 * no pasos, por eso van aparte.
 */
export default function EmbudoBot({ bot }: { bot: InformeBot }) {
  const pasos = [
    { etiqueta: 'Conversaciones', valor: bot.conversaciones },
    { etiqueta: 'Pedidos creados', valor: bot.pedidos },
    { etiqueta: 'Entregados', valor: bot.entregados },
  ];
  const base = Math.max(1, bot.conversaciones);

  return (
    <div>
      <ol className="space-y-1">
        {pasos.map((p, i) => (
          <li key={p.etiqueta}>
            {i > 0 && (
              <p className="flex items-center gap-2 py-1.5 pl-1 text-xs text-zinc-500 dark:text-zinc-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
                <span>
                  <strong className="font-semibold text-zinc-800 tabular-nums dark:text-zinc-200">
                    {pct(p.valor, pasos[i - 1].valor)}
                  </strong>{' '}
                  {i === 1 ? 'terminó en pedido' : 'se entregó'}
                </span>
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{p.etiqueta}</span>
              <span className="font-bold text-zinc-900 tabular-nums dark:text-zinc-50">{p.valor}</span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-r-[4px] bg-[#eb6834] dark:bg-[#d95926]"
                style={{ width: `${Math.max(p.valor > 0 ? 1 : 0, (p.valor / base) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Cancelados</dt>
          <dd className="text-lg font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
            {bot.cancelados}
            <span className="ml-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {pct(bot.cancelados, bot.pedidos)} de los pedidos
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Pasadas a una persona</dt>
          <dd className="text-lg font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
            {bot.derivaciones}
            <span className="ml-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {pct(bot.derivaciones, bot.conversaciones)} de las charlas
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
