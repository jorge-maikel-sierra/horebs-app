import type { ReactNode } from 'react';

export function Contador({
  actual,
  limite,
}: {
  actual: number;
  limite: number;
}) {
  const excedido = actual > limite;
  return (
    <span
      className={`text-xs tabular-nums ${
        excedido
          ? 'font-semibold text-amber-700 dark:text-amber-400'
          : 'text-zinc-500 dark:text-zinc-400'
      }`}
    >
      {actual}/{limite}
      <span className="sr-only">
        {excedido
          ? ' caracteres, supera lo recomendado'
          : ' caracteres recomendados'}
      </span>
    </span>
  );
}

/** Etiqueta visible + ayuda + error, con ids predecibles para aria-describedby. */
export default function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  contador,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  contador?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
        >
          {etiqueta}
        </label>
        {contador}
      </div>
      {children}
      {ayuda && (
        <p
          id={`${id}-ayuda`}
          className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
        >
          {ayuda}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, tieneAyuda: boolean, error?: string) {
  const ids = [tieneAyuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''];
  return ids.filter(Boolean).join(' ') || undefined;
}
