'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export type OpcionMenu = {
  etiqueta: string;
  icono: ReactNode;
  onSelect: () => void;
  deshabilitada?: boolean;
  titulo?: string;
  peligro?: boolean;
};

/** Menú "⋯" de acciones secundarias de una tarjeta de pedido. */
export default function MenuPedido({
  etiqueta,
  opciones,
}: {
  etiqueta: string;
  opciones: OpcionMenu[];
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    raiz.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();

    function alTocarFuera(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    }
    function alPresionar(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      disparador.current?.focus();
    }
    document.addEventListener('pointerdown', alTocarFuera);
    window.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('pointerdown', alTocarFuera);
      window.removeEventListener('keydown', alPresionar);
    };
  }, [abierto]);

  if (opciones.length === 0) return null;

  return (
    <div ref={raiz} className="relative">
      <button
        ref={disparador}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="btn-press -mr-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="animate-desplegar absolute top-full right-0 z-20 mt-1 min-w-52 origin-top-right rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-black/10 dark:border-zinc-700/70 dark:bg-zinc-900 dark:shadow-black/40"
        >
          {opciones.map((o) => (
            <button
              key={o.etiqueta}
              type="button"
              role="menuitem"
              disabled={o.deshabilitada}
              title={o.titulo}
              onClick={() => {
                setAbierto(false);
                o.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                o.peligro
                  ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus-visible:bg-red-950/30'
                  : 'text-zinc-700 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800'
              }`}
            >
              {o.icono}
              {o.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
