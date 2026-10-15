import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconFlechaDerecha } from './iconos';

export default function SeccionPanel({
  titulo,
  subtitulo,
  enlace,
  children,
  className = '',
}: {
  titulo: string;
  subtitulo?: string;
  enlace?: { href: string; texto: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-zinc-200 p-4 sm:p-5 dark:border-zinc-800 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {subtitulo}
            </p>
          )}
        </div>
        {enlace && (
          <Link
            href={enlace.href}
            className="inline-flex items-center gap-1 rounded text-sm font-semibold text-brand-orange-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-brand-orange"
          >
            {enlace.texto}
            <IconFlechaDerecha />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
