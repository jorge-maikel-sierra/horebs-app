import type { ReactNode } from 'react';

export default function Panel({
  titulo,
  subtitulo,
  accion,
  accionEnLinea = false,
  className = '',
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Control a la derecha del título (selector, botón). */
  accion?: ReactNode;
  /** La acción es un enlace corto: queda a la derecha del título aun en teléfono. */
  accionEnLinea?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800 ${className}`}>
      <div
        className={`flex items-start justify-between gap-x-3 gap-y-2 ${accionEnLinea ? '' : 'flex-wrap'}`}
      >
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{titulo}</h2>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitulo}</p>
          )}
        </div>
        {accion && <div className={accionEnLinea ? '-my-1 shrink-0' : ''}>{accion}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
