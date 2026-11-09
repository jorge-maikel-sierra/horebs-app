'use client';

import { useMemo, useState } from 'react';
import { Bricolage_Grotesque } from 'next/font/google';
import { useRol } from '@/lib/use-rol';
import DialogoTiempos from './DialogoTiempos';
import HiloConversacion from './HiloConversacion';
import { useAhora, useConversaciones } from './hooks';
import { IconAjustes, IconBandeja } from './iconos';
import ListaConversaciones from './ListaConversaciones';
import { resumir, tiempoRelativo } from './utilidades';

// Solo para el título y las cifras de esta página: les da carácter sin
// cambiar la tipografía del resto del admin.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';

function Cifra({
  valor,
  etiqueta,
  destacada = false,
}: {
  valor: number;
  etiqueta: string;
  destacada?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
      <dt className="font-mono text-[10px] font-semibold tracking-[0.14em] text-zinc-600 uppercase dark:text-zinc-400">
        {etiqueta}
      </dt>
      <dd
        className={`text-2xl leading-none font-semibold tabular-nums [font-family:var(--font-display)] ${
          destacada && valor > 0
            ? 'text-[var(--accent-ink)]'
            : 'text-zinc-900 dark:text-zinc-50'
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}

export default function SeguimientoPage() {
  const { session } = useRol();
  const usuarioId = session?.user.id ?? null;
  const ahora = useAhora();
  const { conversaciones, cargando, error, actualizadoEn, refrescar, cambiarEstado } =
    useConversaciones();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tiemposAbiertos, setTiemposAbiertos] = useState(false);

  const resumen = useMemo(() => resumir(conversaciones), [conversaciones]);
  const seleccionada =
    conversaciones.find((c) => c.id === seleccionadoId) ?? null;
  const hayHiloAbierto = seleccionada !== null;

  return (
    <div
      className={`${display.variable} mx-auto max-w-[96rem] p-4 sm:p-6 lg:p-8`}
    >
      <header
        className={`items-center justify-between gap-4 sm:items-end ${
          hayHiloAbierto ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="max-w-2xl">
          <p className="hidden font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--accent-ink)] uppercase sm:block">
            Bot · Messenger · Instagram · WhatsApp
          </p>
          <h1 className="mt-1 text-3xl leading-[1.05] sm:text-4xl font-semibold tracking-tight text-zinc-900 [font-family:var(--font-display)] sm:text-5xl dark:text-zinc-50">
            Seguimiento del bot
          </h1>
          <p className="mt-3 hidden text-sm leading-relaxed sm:block text-zinc-700 dark:text-zinc-300">
            Si un cliente deja el pedido a medias, el bot le manda un
            recordatorio y, si sigue sin responder, una oferta. Desde aquí
            atiendes a quienes pidieron hablar con una persona.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p
            className="hidden items-center gap-2 font-mono text-[11px] text-zinc-600 sm:flex dark:text-zinc-400"
            aria-live="off"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                error
                  ? 'bg-red-500'
                  : 'animate-pulse bg-emerald-500 motion-reduce:animate-none'
              }`}
            />
            {error
              ? 'Sin conexión'
              : actualizadoEn
                ? `En vivo · ${tiempoRelativo(new Date(actualizadoEn).toISOString(), ahora)}`
                : 'Conectando…'}
          </p>
          <button
            type="button"
            onClick={() => setTiemposAbiertos(true)}
            aria-label="Configurar tiempos"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 sm:px-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 ${ANILLO}`}
          >
            <IconAjustes className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar tiempos</span>
          </button>
        </div>
      </header>

      <dl
        className={`mt-4 grid-cols-2 sm:mt-6 divide-x divide-dashed divide-zinc-300 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:grid-cols-4 dark:divide-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 ${
          hayHiloAbierto ? 'hidden lg:grid' : 'grid'
        }`}
      >
        <Cifra valor={resumen.porAtender} etiqueta="Esperan al equipo" destacada />
        <Cifra valor={resumen.conBot} etiqueta="Atiende el bot" />
        <Cifra valor={resumen.recordatorios} etiqueta="Recordatorios" />
        <Cifra valor={resumen.ofertas} etiqueta="Ofertas" />
      </dl>

      <section
        aria-label="Conversaciones"
        className={`mt-4 flex overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm lg:h-[calc(100dvh-22rem)] lg:min-h-[32rem] dark:border-zinc-800 dark:bg-zinc-950 ${
          hayHiloAbierto
            ? 'h-[calc(100dvh-5.5rem)]'
            : 'h-[calc(100dvh-17rem)] min-h-[26rem]'
        }`}
      >
        <div
          className={`min-h-0 w-full flex-col border-zinc-200 lg:flex lg:w-[24rem] lg:shrink-0 lg:border-r dark:border-zinc-800 ${
            hayHiloAbierto ? 'hidden' : 'flex'
          }`}
        >
          {error && conversaciones.length === 0 && !cargando ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void refrescar()}
                className={`min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-semibold dark:border-zinc-700 ${ANILLO}`}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <ListaConversaciones
              conversaciones={conversaciones}
              cargando={cargando}
              seleccionadoId={seleccionadoId}
              ahora={ahora}
              onSeleccionar={setSeleccionadoId}
            />
          )}
        </div>

        <div
          className={`min-w-0 flex-1 flex-col lg:flex ${
            hayHiloAbierto ? 'flex' : 'hidden'
          }`}
        >
          {seleccionada ? (
            <HiloConversacion
              key={seleccionada.id}
              conversacion={seleccionada}
              usuarioId={usuarioId}
              ahora={ahora}
              onVolver={() => setSeleccionadoId(null)}
              onCambiarEstado={cambiarEstado}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-50 p-10 text-center dark:bg-zinc-950/60">
              <IconBandeja className="h-12 w-12 text-zinc-400" />
              <p className="text-xl font-semibold text-zinc-900 [font-family:var(--font-display)] dark:text-zinc-50">
                {resumen.porAtender > 0
                  ? `${resumen.porAtender} ${resumen.porAtender === 1 ? 'cliente espera' : 'clientes esperan'} al equipo`
                  : 'Nadie espera al equipo'}
              </p>
              <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                Elige una conversación de la lista para leer el hilo completo.
                Las que esperan al equipo aparecen primero.
              </p>
            </div>
          )}
        </div>
      </section>

      {tiemposAbiertos && (
        <DialogoTiempos onCerrar={() => setTiemposAbiertos(false)} />
      )}
    </div>
  );
}
