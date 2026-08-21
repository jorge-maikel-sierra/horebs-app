'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Algo salió mal
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Tuvimos un problema para cargar esta página. Podés intentar de nuevo o
        volver al inicio.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange hover:text-brand-orange dark:border-zinc-700 dark:text-zinc-300"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
