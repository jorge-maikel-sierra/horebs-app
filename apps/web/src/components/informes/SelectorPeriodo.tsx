'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { diasEntre, etiquetaRango, hoyBogota, type RangoPreset } from '@/lib/informes-rango';
import { plural } from '@/components/informes/informes.tipos';
import { tocar } from '@/lib/retroalimentacion';

/** Etiquetas del control segmentado: cortas para que entren 5 en un teléfono. */
const SEGMENTOS: { key: Exclude<RangoPreset, 'personalizado'>; corto: string; largo: string }[] = [
  { key: 'hoy', corto: 'Hoy', largo: 'Hoy' },
  { key: '7dias', corto: '7 días', largo: 'Últimos 7 días' },
  { key: 'mes', corto: 'Mes', largo: 'Este mes' },
  { key: 'mes_pasado', corto: 'Mes ant.', largo: 'Mes pasado' },
  { key: 'anio', corto: 'Año', largo: 'Este año' },
];

const DIA_MES = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "1–18 nov", "28 oct – 3 nov": rango corto para el botón en teléfono. */
export function rangoCorto(desde: string, hasta: string) {
  const a = new Date(`${desde}T00:00:00Z`);
  const b = new Date(`${hasta}T00:00:00Z`);
  return DIA_MES.formatRange(a, b).replace(/\./g, '');
}

const ESCRITORIO = '(min-width: 640px)';
function suscribir(cb: () => void) {
  const mq = window.matchMedia(ESCRITORIO);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function useEsEscritorio() {
  return useSyncExternalStore(suscribir, () => window.matchMedia(ESCRITORIO).matches, () => false);
}

// Safari de iOS le da a input[type=date] un ancho mínimo propio que ignora
// width: 100% y desborda la caja: appearance-none + min-w-0 lo deja ceñirse.
// El valor se alinea a la izquierda y conserva su alto aunque esté vacío.
const INPUT_FECHA =
  '[color-scheme:light] dark:[color-scheme:dark] block w-full min-w-0 appearance-none bg-transparent text-sm font-semibold text-zinc-900 tabular-nums outline-none dark:text-zinc-50 [&::-webkit-date-and-time-value]:min-h-5 [&::-webkit-date-and-time-value]:text-left';

const CERRAR_TRAS_ELEGIR_MS = 180;
const UMBRAL_ARRASTRE_PX = 90;
const UMBRAL_VELOCIDAD = 500;

function IconCalendario() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function IconChevron({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Botón con el período actual. Abre un control segmentado de atajos y, plegado
 * debajo, el rango de fechas a mano. En teléfono es una hoja que sube desde
 * abajo y se cierra arrastrándola; desde `sm` es un menú bajo el botón.
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
  /** Botón angosto para el encabezado en teléfono. */
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState<RangoPreset>(preset);
  const [fechasAbiertas, setFechasAbiertas] = useState(false);
  const [borradorDesde, setBorradorDesde] = useState(desde);
  const [borradorHasta, setBorradorHasta] = useState(hasta);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const escritorio = useEsEscritorio();
  const reducir = useReducedMotion();
  const arrastre = useDragControls();
  const idPill = useId();

  function cerrar() {
    setAbierto(false);
    botonRef.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      botonRef.current?.focus();
    }
    // Clic afuera: un listener y no una capa fija, porque dentro de la barra
    // con backdrop-blur un `fixed` queda atrapado en la barra.
    function onFuera(e: PointerEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onFuera);
    // La hoja de teléfono tapa la página: que no se desplace por debajo.
    const overflowPrevio = document.body.style.overflow;
    if (!escritorio) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onFuera);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, escritorio]);

  function alternar() {
    if (abierto) return cerrar();
    setElegido(preset);
    setBorradorDesde(desde);
    setBorradorHasta(hasta);
    setFechasAbiertas(preset === 'personalizado');
    setAbierto(true);
  }

  function elegir(p: RangoPreset) {
    // La píldora se mueve primero y el panel se cierra un instante después:
    // así se ve qué quedó elegido antes de que desaparezca.
    if (p !== elegido) tocar();
    setElegido(p);
    onPreset(p);
    window.setTimeout(() => setAbierto(false), reducir ? 0 : CERRAR_TRAS_ELEGIR_MS);
  }

  const hoy = hoyBogota();
  const actual = SEGMENTOS.find((s) => s.key === preset);
  const dias = desde && hasta ? diasEntre(desde, hasta) : 0;
  const completo = Boolean(borradorDesde && borradorHasta);
  const invertido = completo && borradorHasta < borradorDesde;
  const valido = completo && !invertido;
  const etiquetaBoton = actual
    ? compacto
      ? actual.corto
      : actual.largo
    : compacto
      ? rangoCorto(desde, hasta)
      : 'Personalizado';

  const transicionPanel = reducir
    ? { duration: 0 }
    : escritorio
      ? { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }
      : { type: 'spring' as const, damping: 34, stiffness: 380 };
  const oculto = escritorio ? { opacity: 0, scale: 0.96, y: -6 } : { y: '100%' };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="btn-press flex h-11 max-w-full items-center gap-2 rounded-xl border border-zinc-300 bg-white/80 px-3 text-left text-sm transition-colors hover:border-accent-ink dark:border-zinc-700 dark:bg-zinc-900/70"
      >
        <span className="text-accent-ink">
          <IconCalendario />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
            {etiquetaBoton}
          </span>
          {!compacto && (
            <span className="block truncate text-[11px] leading-tight text-zinc-500 tabular-nums dark:text-zinc-400">
              {etiquetaRango(desde, hasta)}
            </span>
          )}
        </span>
        <IconChevron className={`shrink-0 text-zinc-500 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {abierto && !escritorio && (
          <motion.div
            key="fondo"
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducir ? 0 : 0.2 }}
          />
        )}
        {abierto && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal={!escritorio}
            aria-label="Elegir período"
            initial={oculto}
            animate={escritorio ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={oculto}
            transition={transicionPanel}
            drag={escritorio ? false : 'y'}
            dragControls={arrastre}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > UMBRAL_ARRASTRE_PX || info.velocity.y > UMBRAL_VELOCIDAD) cerrar();
            }}
            className={
              escritorio
                ? 'absolute top-full right-0 z-50 mt-2 w-[22rem] origin-top-right rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900'
                : 'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-zinc-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-zinc-800 dark:bg-zinc-900'
            }
          >
            {!escritorio && (
              // Zona de arrastre: la manija y el encabezado bajan la hoja; los
              // controles de abajo siguen respondiendo a toques normales.
              <div
                onPointerDown={(e) => arrastre.start(e)}
                className="-mx-4 flex cursor-grab touch-none justify-center pt-2.5 pb-3 active:cursor-grabbing"
              >
                <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
            )}

            <div
              onPointerDown={escritorio ? undefined : (e) => arrastre.start(e)}
              className={escritorio ? '' : 'touch-none'}
            >
              <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Período
              </p>
              <p className="mt-0.5 text-lg font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
                {etiquetaRango(desde, hasta)}
              </p>
              <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                {dias > 0 && plural(dias, 'día')}
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Atajos de período"
              className="mt-4 grid grid-cols-5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70"
            >
              {SEGMENTOS.map((s) => {
                const sel = elegido === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    aria-label={s.largo}
                    onClick={() => elegir(s.key)}
                    className={`relative h-10 rounded-lg text-[13px] font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                      sel ? 'text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
                    }`}
                  >
                    {sel && (
                      <motion.span
                        layoutId={`pildora-periodo-${idPill}`}
                        transition={reducir ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.35 }}
                        className="btn-gradient absolute inset-0 rounded-lg shadow-sm"
                      />
                    )}
                    <span className="relative">{s.corto}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setFechasAbiertas((f) => !f)}
              aria-expanded={fechasAbiertas}
              className={`mt-3 flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors ${
                elegido === 'personalizado'
                  ? 'bg-brand-orange/12 text-accent-ink'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconCalendario />
                Elegir fechas
              </span>
              <IconChevron className={`transition-transform duration-200 ${fechasAbiertas ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {fechasAbiertas && (
                <motion.div
                  key="fechas"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reducir ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    {/* Desde y Hasta en una sola caja partida: no hay dos
                        controles que puedan empujarse entre sí. */}
                    <div className="flex rounded-xl border border-zinc-300 transition-colors focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20 dark:border-zinc-700">
                      <label className="min-w-0 flex-1 px-3 py-2">
                        <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Desde</span>
                        <input
                          type="date"
                          value={borradorDesde}
                          max={borradorHasta || hoy}
                          onChange={(e) => setBorradorDesde(e.target.value)}
                          className={INPUT_FECHA}
                        />
                      </label>
                      <span aria-hidden="true" className="my-2 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
                      <label className="min-w-0 flex-1 px-3 py-2">
                        <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Hasta</span>
                        <input
                          type="date"
                          value={borradorHasta}
                          min={borradorDesde || undefined}
                          max={hoy}
                          onChange={(e) => setBorradorHasta(e.target.value)}
                          className={INPUT_FECHA}
                        />
                      </label>
                    </div>
                    <p
                      role={invertido ? 'alert' : undefined}
                      className={`mt-2 min-h-4 text-xs ${invertido ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`}
                    >
                      {invertido
                        ? 'La fecha final no puede ser anterior a la inicial.'
                        : valido
                          ? `${plural(diasEntre(borradorDesde, borradorHasta), 'día seleccionado', 'días seleccionados')}`
                          : ''}
                    </p>
                    <button
                      type="button"
                      disabled={!valido}
                      onClick={() => {
                        onPersonalizado(borradorDesde, borradorHasta);
                        setElegido('personalizado');
                        cerrar();
                      }}
                      className="btn-gradient btn-press mt-2 h-11 w-full rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aplicar fechas
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
