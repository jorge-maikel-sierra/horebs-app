'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Solo entra en juego si el propio layout raíz revienta — Next exige que
 * este archivo traiga su <html>/<body> porque reemplaza el layout entero.
 */
export default function GlobalError({
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
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center font-sans">
        <h1 className="text-2xl font-bold text-zinc-900">Algo salió mal</h1>
        <p className="text-sm text-zinc-500">
          Tuvimos un problema para cargar el sitio. Intentá de nuevo en un
          momento.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
