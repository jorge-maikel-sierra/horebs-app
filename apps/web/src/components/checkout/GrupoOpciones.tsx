import type { ReactNode } from 'react';

export type Opcion<T extends string> = { valor: T; etiqueta: string; icono: ReactNode };

/**
 * Grupo de radios nativos con forma de tarjeta: el navegador da gratis las
 * flechas, el foco y el anuncio "1 de 3". La opción elegida no se rellena
 * de naranja (el único relleno naranja del checkout es "Pedir"): lleva
 * borde de tinta naranja, fondo tenue y un check.
 */
export default function GrupoOpciones<T extends string>({
  nombre,
  leyenda,
  opciones,
  valor,
  onCambiar,
  columnas,
}: {
  nombre: string;
  leyenda: string;
  opciones: Opcion<T>[];
  valor: T;
  onCambiar: (v: T) => void;
  columnas: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{leyenda}</legend>
      <div className={`mt-2 grid gap-2.5 sm:gap-3 ${columnas === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {opciones.map((o) => {
          const sel = o.valor === valor;
          return (
            <label key={o.valor} className="btn-press relative block cursor-pointer">
              <input
                type="radio"
                name={nombre}
                value={o.valor}
                checked={sel}
                onChange={() => onCambiar(o.valor)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-3 text-center transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-orange/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${
                  sel
                    ? 'border-accent-ink bg-brand-orange-50 text-accent-ink dark:bg-brand-orange-900/25'
                    : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {o.icono}
                <span className="text-[13px] leading-tight font-semibold sm:text-sm">{o.etiqueta}</span>
              </span>
              {sel && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent-ink text-white dark:text-zinc-950"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
