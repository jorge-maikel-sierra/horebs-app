import type { ReactNode } from 'react';

export default function Panel({
  titulo,
  subtitulo,
  accion,
  className = '',
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Control a la derecha del título (selector, botón). */
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{titulo}</h2>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitulo}</p>
          )}
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
