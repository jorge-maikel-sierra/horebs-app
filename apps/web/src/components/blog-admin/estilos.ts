// text-base en móvil evita el zoom automático de iOS al enfocar un campo.
const CAMPO_BASE =
  'mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 sm:text-sm dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export function claseCampo(invalido: boolean) {
  return `${CAMPO_BASE} ${
    invalido
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/25'
      : 'border-zinc-300 focus:border-brand-orange focus:ring-brand-orange/25 dark:border-zinc-700'
  }`;
}

export const FOCO =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60';

export const TARJETA =
  'card-gradient rounded-2xl border border-zinc-200 p-4 sm:p-5 dark:border-zinc-800';
