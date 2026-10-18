import { FOCO } from '@/components/formulario/estilos';

/**
 * Control segmentado (un grupo de botones `aria-pressed`) con contador opcional
 * por opción. Los botones envuelven en varias líneas: nunca hace scroll
 * horizontal, así no desborda en móvil.
 */
export default function Segmentado<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambiar,
}: {
  etiqueta: string;
  valor: T;
  opciones: { valor: T; texto: string; conteo?: number }[];
  onCambiar: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800/70"
    >
      {opciones.map((o) => {
        const activo = valor === o.valor;
        const vacio = o.conteo === 0 && !activo;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(o.valor)}
            className={`btn-press flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors ${FOCO} ${
              activo
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                : vacio
                  ? 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
            }`}
          >
            {o.texto}
            {o.conteo !== undefined && (
              <span
                className={`text-xs font-bold tabular-nums ${
                  activo
                    ? 'text-accent-ink'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {o.conteo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
