'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function ModalConfirmar({
  titulo,
  descripcion,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  peligro = false,
  cargando = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar: string;
  textoCancelar?: string;
  peligro?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const idTitulo = useId();
  const idDescripcion = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const cancelarActual = useRef(onCancelar);
  const cargandoActual = useRef(cargando);

  useEffect(() => {
    cancelarActual.current = onCancelar;
    cargandoActual.current = cargando;
  });

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    // En acciones destructivas el foco inicial va a la opción segura.
    cancelarRef.current?.focus();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!cargandoActual.current) cancelarActual.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const enfocables =
        dialogoRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])',
        ) ?? [];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
      previo?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!cargando) onCancelar();
        }}
      />
      <div
        ref={dialogoRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idDescripcion}
        className="animate-fade-up relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2
          id={idTitulo}
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {titulo}
        </h2>
        <div
          id={idDescripcion}
          className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400"
        >
          {descripcion}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            disabled={cargando}
            className="btn-press h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cargando}
            className={`btn-press h-11 flex-1 rounded-xl text-sm font-semibold text-white outline-none transition focus-visible:ring-2 disabled:opacity-60 ${
              peligro
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/60'
                : 'btn-gradient focus-visible:ring-brand-orange/60'
            }`}
          >
            {cargando ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
