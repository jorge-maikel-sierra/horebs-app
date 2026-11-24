import type { InputHTMLAttributes, ReactNode } from 'react';

const BASE =
  'mt-1.5 block w-full rounded-xl border bg-white px-3 text-base text-zinc-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-zinc-400 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 sm:text-sm dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';
const BORDE_OK = 'border-zinc-300 dark:border-zinc-700';
const BORDE_ERROR = 'border-danger-500 dark:border-danger-400';

/**
 * Campo del checkout: etiqueta asociada al input, pista y error debajo del
 * propio campo (no al pie del formulario), con `aria-invalid` y
 * `aria-describedby` para que el lector de pantalla lea las dos cosas.
 * 16px de letra en teléfono: con menos, Safari de iOS hace zoom al enfocar.
 */
export default function CampoCheckout({
  id,
  etiqueta,
  pista,
  error,
  multilinea = false,
  value,
  onChange,
  ...resto
}: {
  id: string;
  etiqueta: string;
  pista?: ReactNode;
  error?: string;
  multilinea?: boolean;
  value: string;
  onChange: (valor: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>) {
  const idPista = pista ? `${id}-pista` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describe = [idError, idPista].filter(Boolean).join(' ') || undefined;
  const clase = `${BASE} ${error ? BORDE_ERROR : BORDE_OK}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {etiqueta}
      </label>
      {multilinea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          aria-describedby={describe}
          className={`${clase} py-2.5`}
          placeholder={resto.placeholder}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          className={`${clase} h-11`}
          {...resto}
        />
      )}
      {error && (
        <p id={idError} className="mt-1.5 text-sm font-medium text-danger-700 dark:text-danger-400">
          {error}
        </p>
      )}
      {pista && (
        <p id={idPista} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {pista}
        </p>
      )}
    </div>
  );
}
