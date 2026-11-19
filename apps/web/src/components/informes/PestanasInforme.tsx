'use client';

import { useRef, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type VistaInforme = 'resumen' | 'productos' | 'clientes' | 'bots';

export const VISTAS: { key: VistaInforme; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'productos', label: 'Productos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'bots', label: 'Bots' },
];

export const idPanel = (v: string, grupo = 'informe') => `panel-${grupo}-${v}`;
const idPestana = (v: string, grupo = 'informe') => `pestana-${grupo}-${v}`;

/**
 * Pestañas ARIA con indicador animado. `grupo` separa los ids y el
 * `layoutId` cuando la usan varias páginas (informes, anuncios).
 */
export default function PestanasInforme<T extends string = VistaInforme>({
  vistas,
  activa,
  onCambiar,
  grupo = 'informe',
  etiqueta = 'Secciones del informe',
  className = '',
}: {
  vistas: { key: T; label: string }[];
  activa: T;
  onCambiar: (v: T) => void;
  grupo?: string;
  etiqueta?: string;
  className?: string;
}) {
  const reducir = useReducedMotion();
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  // Patrón ARIA de pestañas: flechas, Inicio y Fin mueven el foco y activan.
  function onKeyDown(e: KeyboardEvent) {
    const i = vistas.findIndex((v) => v.key === activa);
    const destino =
      e.key === 'ArrowRight' ? (i + 1) % vistas.length
      : e.key === 'ArrowLeft' ? (i - 1 + vistas.length) % vistas.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? vistas.length - 1
      : null;
    if (destino === null) return;
    e.preventDefault();
    const v = vistas[destino].key;
    onCambiar(v);
    refs.current[v]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={onKeyDown}
      className={`flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900 ${className}`}
    >
      {vistas.map((v) => {
        const sel = v.key === activa;
        return (
          <button
            key={v.key}
            ref={(el) => {
              refs.current[v.key] = el;
            }}
            id={idPestana(v.key, grupo)}
            type="button"
            role="tab"
            aria-selected={sel}
            aria-controls={idPanel(v.key, grupo)}
            tabIndex={sel ? 0 : -1}
            onClick={() => onCambiar(v.key)}
            className={`relative h-9 flex-1 rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 @xl:flex-none @xl:px-4 ${
              sel
                ? 'text-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {sel && (
              <motion.span
                layoutId={`pestana-${grupo}-activa`}
                transition={reducir ? { duration: 0 } : { type: 'spring', bounce: 0.18, duration: 0.4 }}
                className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-zinc-700"
              />
            )}
            <span className="relative">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function propsPanel(v: string, grupo = 'informe') {
  return {
    id: idPanel(v, grupo),
    role: 'tabpanel',
    'aria-labelledby': idPestana(v, grupo),
    tabIndex: -1,
  } as const;
}
