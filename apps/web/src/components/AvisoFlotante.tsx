import type { Aviso } from '@/lib/use-aviso';

/** La región aria-live existe siempre; así los lectores de pantalla anuncian cada aviso nuevo. */
export default function AvisoFlotante({ aviso }: { aviso: Aviso | null }) {
  return (
    <div role="status" aria-live="polite" className="contents">
      {aviso && (
        <p
          className={`animate-fade-up fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg ${
            aviso.error
              ? 'bg-red-600 text-white'
              : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
