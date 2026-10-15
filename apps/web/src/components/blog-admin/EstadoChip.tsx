import type { Estado } from './tipos';

/** Estado con punto + texto: nunca depende solo del color. */
export default function EstadoChip({ estado }: { estado: Estado }) {
  const publicado = estado === 'publicado';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        publicado
          ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          publicado
            ? 'bg-green-600 dark:bg-green-400'
            : 'border border-zinc-500 dark:border-zinc-400'
        }`}
      />
      {publicado ? 'Publicado' : 'Borrador'}
    </span>
  );
}
