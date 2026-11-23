import type { Alerta } from '@/components/google-ads/google-ads.tipos';

const ESTILO: Record<Alerta['severidad'], { borde: string; chip: string; texto: string }> = {
  critica: {
    borde: 'border-red-300 dark:border-red-900',
    chip: 'bg-red-600 text-white',
    texto: 'Crítica',
  },
  alta: {
    borde: 'border-orange-300 dark:border-orange-900',
    chip: 'bg-brand-orange text-white',
    texto: 'Alta',
  },
  media: {
    borde: 'border-amber-200 dark:border-amber-900/60',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    texto: 'Media',
  },
  baja: {
    borde: 'border-zinc-200 dark:border-zinc-800',
    chip: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    texto: 'Baja',
  },
};

/** Qué pasó, el dato y qué hacer. Ordenadas de crítica a baja por el API. */
export default function PanelAlertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-400">
        Sin alertas: nada pide acción con los datos de este período.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 @3xl:grid-cols-2" aria-label="Alertas">
      {alertas.map((a, i) => {
        const e = ESTILO[a.severidad];
        return (
          <li key={`${a.codigo}-${i}`} className={`rounded-2xl border p-4 ${e.borde}`}>
            <div className="flex items-start gap-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${e.chip}`}>
                {e.texto}
              </span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{a.titulo}</p>
            </div>
            <p className="mt-2 text-sm [overflow-wrap:anywhere] text-zinc-600 dark:text-zinc-400">{a.detalle}</p>
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span aria-hidden="true">→ </span>
              {a.accion}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
