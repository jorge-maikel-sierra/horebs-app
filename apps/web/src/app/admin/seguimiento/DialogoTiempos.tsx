'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { IconCerrar } from './iconos';
import { VENTANA_META_MINUTOS } from './tipos';
import { minutosEnPalabras } from './utilidades';

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';
const ATAJOS_RECORDATORIO = [60, 120, 180, 240];
const ATAJOS_OFERTA = [120, 180, 360, 720];
const DEFECTO_RECORDATORIO = 180;
const DEFECTO_OFERTA = 360;

function Campo({
  id,
  etiqueta,
  ayuda,
  valor,
  atajos,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  valor: number;
  atajos: number[];
  onCambio: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {etiqueta}
      </label>
      <p id={`${id}-ayuda`} className="text-xs text-zinc-600 dark:text-zinc-400">
        {ayuda}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            id={id}
            required
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={Number.isFinite(valor) ? valor : ''}
            aria-describedby={`${id}-ayuda`}
            onChange={(e) => onCambio(Number(e.target.value))}
            className={`h-11 w-32 rounded-xl border border-zinc-300 bg-white pr-12 pl-3 font-mono text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${ANILLO}`}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-zinc-500">
            min
          </span>
        </div>
        <span className="font-mono text-sm text-[var(--accent-ink)]">
          = {minutosEnPalabras(valor)}
        </span>
      </div>
      <div
        role="group"
        aria-label={`Atajos para ${etiqueta.toLowerCase()}`}
        className="mt-2 flex flex-wrap gap-2"
      >
        {atajos.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={valor === m}
            onClick={() => onCambio(m)}
            className={`min-h-9 rounded-full border px-3 font-mono text-xs font-semibold transition-colors ${ANILLO} ${
              valor === m
                ? 'border-[var(--accent-ink)] bg-brand-orange/15 text-zinc-900 dark:text-zinc-50'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {minutosEnPalabras(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

function LineaDeTiempo({
  recordatorio,
  oferta,
}: {
  recordatorio: number;
  oferta: number;
}) {
  const total = recordatorio + oferta;
  const pasos = [
    { marca: 'Inicio', texto: 'El cliente deja de responder' },
    {
      marca: `+${minutosEnPalabras(recordatorio)}`,
      texto: 'El bot manda el recordatorio',
    },
    {
      marca: `+${minutosEnPalabras(total)}`,
      texto: `Si sigue sin responder, manda la oferta (${minutosEnPalabras(oferta)} después del recordatorio)`,
    },
  ];
  return (
    <ol
      aria-label="Línea de tiempo del seguimiento"
      className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60"
    >
      {pasos.map((p, i) => (
        <li key={p.marca + i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < pasos.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute top-4 bottom-0 left-[5px] w-px bg-zinc-300 dark:bg-zinc-700"
            />
          )}
          <span
            aria-hidden="true"
            className={`relative mt-1 h-3 w-3 shrink-0 rounded-full ${
              i === 0 ? 'bg-zinc-400' : 'bg-brand-orange'
            }`}
          />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="mr-2 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-50">
              {p.marca}
            </span>
            {p.texto}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function DialogoTiempos({ onCerrar }: { onCerrar: () => void }) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const [recordatorio, setRecordatorio] = useState(DEFECTO_RECORDATORIO);
  const [oferta, setOferta] = useState(DEFECTO_OFERTA);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  useEffect(() => {
    adminFetch('/admin/seguimiento/configuracion')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuración.');
        const datos = await res.json();
        setRecordatorio(datos.recordatorio_minutos);
        setOferta(datos.oferta_minutos);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));
  }, []);

  const valido =
    Number.isInteger(recordatorio) &&
    recordatorio >= 1 &&
    Number.isInteger(oferta) &&
    oferta >= 1;
  const fueraDeVentana = valido && recordatorio + oferta > VENTANA_META_MINUTOS;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setError(null);
    setGuardado(false);
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/seguimiento/configuracion', {
        method: 'PATCH',
        body: JSON.stringify({
          recordatorio_minutos: recordatorio,
          oferta_minutos: oferta,
        }),
      });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo guardar.'));
      setGuardado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <dialog
      ref={dialogoRef}
      aria-labelledby="titulo-tiempos"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close();
      }}
      className="animate-fade-up m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/55 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <form onSubmit={guardar} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-tiempos" className="text-lg font-semibold">
              Tiempos de seguimiento
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Cuándo escribe el bot a quien dejó el pedido a medias.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogoRef.current?.close()}
            aria-label="Cerrar"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 ${ANILLO}`}
          >
            <IconCerrar className="h-5 w-5" />
          </button>
        </div>

        {cargando ? (
          <div className="mt-6 space-y-3" aria-hidden="true">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <Campo
              id="tiempo-recordatorio"
              etiqueta="Recordatorio"
              ayuda="Minutos sin respuesta del cliente antes de recordarle su pedido."
              valor={recordatorio}
              atajos={ATAJOS_RECORDATORIO}
              onCambio={setRecordatorio}
            />
            <Campo
              id="tiempo-oferta"
              etiqueta="Oferta"
              ayuda="Minutos después del recordatorio para mandar la oferta."
              valor={oferta}
              atajos={ATAJOS_OFERTA}
              onCambio={setOferta}
            />
            {valido && <LineaDeTiempo recordatorio={recordatorio} oferta={oferta} />}
            {fueraDeVentana && (
              <p
                role="status"
                className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
              >
                Con estos tiempos la oferta sale pasadas 24 horas. Meta solo
                deja escribirle al cliente dentro de esa ventana, así que la
                oferta podría no llegar.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <div aria-live="polite" className="mr-auto text-sm">
            {error && <span className="text-red-700 dark:text-red-400">{error}</span>}
            {guardado && !error && (
              <span className="font-semibold text-[var(--accent-ink)]">
                Guardado ✓
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => dialogoRef.current?.close()}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 ${ANILLO}`}
          >
            Cerrar
          </button>
          <button
            type="submit"
            disabled={cargando || guardando || !valido}
            className={`btn-gradient btn-press min-h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50 ${ANILLO} focus-visible:ring-offset-2`}
          >
            {guardando ? 'Guardando…' : 'Guardar tiempos'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
