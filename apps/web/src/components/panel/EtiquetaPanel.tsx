import type { ReactNode } from 'react';

/** Rótulo de sección del panel; su `id` lo usa el `aria-labelledby`. */
export default function EtiquetaPanel({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400"
    >
      {children}
    </h2>
  );
}
