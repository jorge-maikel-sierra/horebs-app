'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ANCHOS = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
} as const;

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cascarón de modal del panel: fondo oscurecido al 20 % y desenfocado, cajón
 * inferior en móvil y diálogo centrado desde `sm`. Encabezado fijo, cuerpo con
 * scroll y pie opcional siempre visible (acciones).
 */
export default function ModalBase({
  titulo,
  subtitulo,
  ancho = 'md',
  cerrarConFondo = true,
  enfocarPrimerCampo = true,
  bloqueado = false,
  pie,
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  ancho?: keyof typeof ANCHOS;
  /** false en formularios: un clic accidental fuera no debe perder lo escrito. */
  cerrarConFondo?: boolean;
  /** false si el primer campo es un buscador: en móvil abriría el teclado sin que nadie lo pida. */
  enfocarPrimerCampo?: boolean;
  /** true mientras se guarda: no se puede cerrar. */
  bloqueado?: boolean;
  pie?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const idTitulo = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  // Solo importa al montar: el foco inicial no se vuelve a mover.
  const enfocarInicial = useRef(enfocarPrimerCampo);
  const cerrarActual = useRef(onCerrar);
  const bloqueadoActual = useRef(bloqueado);

  useEffect(() => {
    cerrarActual.current = onCerrar;
    bloqueadoActual.current = bloqueado;
  });

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const dialogo = dialogoRef.current;
    // Primer campo del cuerpo si hay; si no, el propio diálogo.
    const primero = enfocarInicial.current
      ? dialogo?.querySelector<HTMLElement>(
          '[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        )
      : null;
    (primero ?? dialogo)?.focus();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Si hay otro diálogo encima (p. ej. confirmar descarte), le toca a él.
        const dialogos = document.querySelectorAll(
          '[role="dialog"], [role="alertdialog"]',
        );
        if (dialogos[dialogos.length - 1] !== dialogoRef.current) return;
        if (!bloqueadoActual.current) cerrarActual.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const dialogos = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]',
      );
      if (dialogos[dialogos.length - 1] !== dialogoRef.current) return;
      const enfocables = [
        ...dialogoRef.current.querySelectorAll<HTMLElement>(FOCALIZABLES),
      ].filter((el) => el.offsetParent !== null);
      if (enfocables.length === 0) return;
      const primeroTab = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === primeroTab ||
          document.activeElement === dialogoRef.current)
      ) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeroTab.focus();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onClick={() => {
          if (cerrarConFondo && !bloqueado) onCerrar();
        }}
      />
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`animate-fade-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-zinc-200 bg-white shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900 ${ANCHOS[ancho]}`}
      >
        <span
          aria-hidden="true"
          className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700"
        />

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3 sm:pt-5">
          <div className="min-w-0">
            <h2
              id={idTitulo}
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {subtitulo}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
            className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 outline-none hover:bg-zinc-100 hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-zinc-100 px-5 py-4 dark:border-zinc-800/70">
          {children}
        </div>

        {pie && (
          <div className="shrink-0 border-t border-zinc-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800/70">
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
