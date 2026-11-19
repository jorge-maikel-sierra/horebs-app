'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PRESETS_INFORME,
  diasEntre,
  etiquetaRango,
  type RangoPreset,
} from '@/lib/informes-rango';
import { plural } from '@/components/informes/informes.tipos';

const INPUT_FECHA =
  '[color-scheme:light] dark:[color-scheme:dark] mt-1 h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors hover:border-accent-ink focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

function IconCalendario() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/**
 * Botón con el período actual que abre los atajos y el rango personalizado:
 * en teléfono como hoja desde abajo, desde `sm` como menú bajo el botón.
 */
export default function SelectorPeriodo({
  preset,
  desde,
  hasta,
  onPreset,
  onPersonalizado,
  compacto = false,
}: {
  preset: RangoPreset;
  desde: string;
  hasta: string;
  onPreset: (p: RangoPreset) => void;
  onPersonalizado: (desde: string, hasta: string) => void;
  /** Solo el nombre corto del período (para el encabezado en teléfono). */
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borradorDesde, setBorradorDesde] = useState(desde);
  const [borradorHasta, setBorradorHasta] = useState(hasta);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    panelRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    }
    // Clic afuera: un listener y no una capa fija, porque dentro de la barra
    // con backdrop-blur un `fixed` queda atrapado en la barra.
    function onFuera(e: PointerEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onFuera);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onFuera);
    };
  }, [abierto]);

  function abrir() {
    setBorradorDesde(desde);
    setBorradorHasta(hasta);
    setAbierto((a) => !a);
  }

  function elegir(p: RangoPreset) {
    onPreset(p);
    setAbierto(false);
  }

  const actual = PRESETS_INFORME.find((p) => p.key === preset);
  const rango = etiquetaRango(desde, hasta);
  const dias = desde && hasta ? diasEntre(desde, hasta) : 0;
  const invertido = Boolean(borradorDesde && borradorHasta) && borradorHasta < borradorDesde;
  const valido = Boolean(borradorDesde && borradorHasta) && !invertido;

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="flex h-11 max-w-full items-center gap-2 rounded-xl border border-zinc-300 bg-white/80 px-3 text-left text-sm transition-colors hover:border-accent-ink dark:border-zinc-700 dark:bg-zinc-900/70"
      >
        <span className="text-accent-ink">
          <IconCalendario />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-zinc-900 dark:text-zinc-50">
            {actual ? (compacto ? actual.corto : actual.largo) : compacto ? 'Rango' : rango}
          </span>
          {!compacto && actual && (
            <span className="block truncate text-[11px] leading-tight text-zinc-500 tabular-nums dark:text-zinc-400">
              {rango}
            </span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-zinc-500 transition-transform ${abierto ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs sm:hidden" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Elegir período"
            className="animate-fade-up fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-zinc-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-2 sm:w-80 sm:rounded-2xl sm:pb-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" />
            <div role="radiogroup" aria-label="Atajos" className="grid grid-cols-2 gap-1.5 sm:grid-cols-1 sm:gap-0.5">
              {PRESETS_INFORME.map((p) => {
                const sel = p.key === preset;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => elegir(p.key)}
                    className={`flex h-11 items-center justify-between rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/50 sm:h-10 ${
                      sel
                        ? 'bg-brand-orange/12 text-accent-ink'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {p.largo}
                    {sel && <IconCheck />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Rango personalizado
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Desde
                  <input type="date" value={borradorDesde} max={borradorHasta || undefined} onChange={(e) => setBorradorDesde(e.target.value)} className={INPUT_FECHA} />
                </label>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Hasta
                  <input type="date" value={borradorHasta} min={borradorDesde || undefined} onChange={(e) => setBorradorHasta(e.target.value)} className={INPUT_FECHA} />
                </label>
              </div>
              <p
                role={invertido ? 'alert' : undefined}
                className={`mt-2 min-h-5 text-xs ${invertido ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                {invertido
                  ? 'La fecha final no puede ser anterior a la inicial.'
                  : valido
                    ? `${plural(diasEntre(borradorDesde, borradorHasta), 'día')} seleccionados`
                    : ''}
              </p>
              <button
                type="button"
                disabled={!valido}
                onClick={() => {
                  onPersonalizado(borradorDesde, borradorHasta);
                  setAbierto(false);
                }}
                className="btn-gradient btn-press mt-2 h-11 w-full rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aplicar rango
              </button>
            </div>
            {dias > 0 && (
              <p className="sr-only" aria-live="polite">
                Período actual: {rango}, {dias} días
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
