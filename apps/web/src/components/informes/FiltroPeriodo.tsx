'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { diasEntre, etiquetaRango } from '@/lib/informes-rango';

export type PresetOpcion<K extends string> = {
  key: K;
  corto: string;
  largo: string;
};

function IconCalendario() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function IconChevronAbajo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const CHIP_BASE =
  'inline-flex h-10 shrink-0 snap-start items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors';
const CHIP_ACTIVO = 'btn-gradient text-white shadow-sm';
const CHIP_INACTIVO =
  'border border-zinc-300 bg-white/70 text-zinc-600 hover:border-accent-ink hover:text-accent-ink dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300';

const INPUT_FECHA =
  '[color-scheme:light] dark:[color-scheme:dark] h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors hover:border-accent-ink focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

export default function FiltroPeriodo<K extends string>({
  presets,
  activo,
  personalizadoKey,
  desde,
  hasta,
  onPreset,
  onRangoPersonalizado,
}: {
  presets: PresetOpcion<K>[];
  activo: K;
  personalizadoKey: K;
  desde: string;
  hasta: string;
  onPreset: (key: K) => void;
  onRangoPersonalizado: (desde: string, hasta: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borradorDesde, setBorradorDesde] = useState(desde);
  const [borradorHasta, setBorradorHasta] = useState(hasta);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    dialogoRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  function abrir() {
    setBorradorDesde(desde);
    setBorradorHasta(hasta);
    setAbierto(true);
  }

  const completo = Boolean(borradorDesde && borradorHasta);
  const invertido = completo && borradorHasta < borradorDesde;
  const valido = completo && !invertido;
  const personalizadoActivo = activo === personalizadoKey;

  return (
    <>
      <div
        role="group"
        aria-label="Período del informe"
        className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={activo === p.key}
            onClick={() => onPreset(p.key)}
            className={`${CHIP_BASE} ${activo === p.key ? CHIP_ACTIVO : CHIP_INACTIVO}`}
          >
            <span className="sm:hidden">{p.corto}</span>
            <span className="hidden sm:inline">{p.largo}</span>
          </button>
        ))}

        <button
          type="button"
          aria-pressed={personalizadoActivo}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          onClick={abrir}
          className={`${CHIP_BASE} ${personalizadoActivo ? CHIP_ACTIVO : CHIP_INACTIVO}`}
        >
          <IconCalendario />
          {personalizadoActivo ? etiquetaRango(desde, hasta) : 'Personalizado'}
          <IconChevronAbajo />
        </button>
      </div>

      {abierto &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-xs sm:items-center sm:p-4">
            <div
              className="absolute inset-0"
              onClick={() => setAbierto(false)}
            />
            <div
              ref={dialogoRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-rango"
              className="animate-fade-up relative w-full rounded-t-3xl border border-zinc-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-w-sm sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" />
              <h2
                id="titulo-rango"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
              >
                Rango personalizado
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Elige desde y hasta qué día quieres ver el informe.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Desde
                  <input
                    type="date"
                    value={borradorDesde}
                    max={borradorHasta || undefined}
                    onChange={(e) => setBorradorDesde(e.target.value)}
                    className={`${INPUT_FECHA} mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Hasta
                  <input
                    type="date"
                    value={borradorHasta}
                    min={borradorDesde || undefined}
                    onChange={(e) => setBorradorHasta(e.target.value)}
                    className={`${INPUT_FECHA} mt-1`}
                  />
                </label>
              </div>

              <p
                role={invertido ? 'alert' : undefined}
                className={`mt-3 min-h-5 text-sm ${
                  invertido
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {invertido
                  ? 'La fecha final no puede ser anterior a la inicial.'
                  : valido
                    ? `${diasEntre(borradorDesde, borradorHasta)} ${
                        diasEntre(borradorDesde, borradorHasta) === 1
                          ? 'día'
                          : 'días'
                      } seleccionados`
                    : ''}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!valido}
                  onClick={() => {
                    onRangoPersonalizado(borradorDesde, borradorHasta);
                    setAbierto(false);
                  }}
                  className="btn-gradient btn-press h-11 flex-1 rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
