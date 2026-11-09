'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import { IconBandeja, IconBuscar, InsigniaCanal } from './iconos';
import {
  ETIQUETA_CANAL,
  ETIQUETA_ETAPA,
  PASOS_ETAPA,
  type Canal,
  type Conversacion,
  type FiltroVista,
} from './tipos';
import {
  filtrarConversaciones,
  nombreCliente,
  ordenarConversaciones,
  resumir,
  tiempoRelativo,
} from './utilidades';

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';
const CANALES: Canal[] = ['whatsapp', 'messenger', 'instagram'];

type Props = {
  conversaciones: Conversacion[];
  cargando: boolean;
  seleccionadoId: string | null;
  ahora: number;
  onSeleccionar: (id: string) => void;
};

function Pasos({ etapa }: { etapa: Conversacion['seguimiento_etapa'] }) {
  const hechos = PASOS_ETAPA[etapa];
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2].map((paso) => (
        <span
          key={paso}
          className={`h-1.5 w-1.5 rounded-full ${
            paso <= hechos
              ? 'bg-[var(--accent-ink)]'
              : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
        />
      ))}
    </span>
  );
}

function Fila({
  c,
  activa,
  ahora,
  onSeleccionar,
}: {
  c: Conversacion;
  activa: boolean;
  ahora: number;
  onSeleccionar: (id: string) => void;
}) {
  const derivada = c.estado === 'derivado';
  return (
    <li>
      <button
        type="button"
        data-fila
        aria-current={activa ? 'true' : undefined}
        onClick={() => onSeleccionar(c.id)}
        className={`relative grid min-h-[4.5rem] w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors ${ANILLO} focus-visible:ring-inset ${
          activa
            ? 'bg-brand-orange/10 dark:bg-brand-orange/15'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
        }`}
      >
        {(activa || derivada) && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${
              activa ? 'bg-[var(--accent-ink)]' : 'bg-brand-orange/60'
            }`}
          />
        )}
        <InsigniaCanal canal={c.canal} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {nombreCliente(c)}
          </span>
          <span className="mt-1 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            {derivada ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange/15 px-2 py-0.5 font-semibold text-[var(--accent-ink)]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange motion-reduce:animate-none"
                />
                Espera al equipo
              </span>
            ) : (
              <>
                <Pasos etapa={c.seguimiento_etapa} />
                <span className="truncate">
                  {ETIQUETA_ETAPA[c.seguimiento_etapa]}
                </span>
              </>
            )}
          </span>
        </span>
        <time
          dateTime={c.ultima_interaccion}
          className="self-start pt-0.5 font-mono text-[11px] whitespace-nowrap text-zinc-500 dark:text-zinc-400"
        >
          {tiempoRelativo(c.ultima_interaccion, ahora)}
        </time>
        <span className="sr-only">
          {ETIQUETA_CANAL[c.canal]}
          {derivada ? ', espera al equipo' : ', atiende el bot'}
        </span>
      </button>
    </li>
  );
}

function Seccion({
  titulo,
  cantidad,
  children,
}: {
  titulo: string;
  cantidad: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo}>
      <h3 className="sticky top-0 z-10 flex items-center justify-between border-y border-zinc-200 bg-zinc-50/95 px-4 py-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-zinc-600 uppercase backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-400">
        {titulo}
        <span>{cantidad}</span>
      </h3>
      <ul className="divide-y divide-dashed divide-zinc-200 dark:divide-zinc-800">
        {children}
      </ul>
    </section>
  );
}

export default function ListaConversaciones({
  conversaciones,
  cargando,
  seleccionadoId,
  ahora,
  onSeleccionar,
}: Props) {
  const [vista, setVista] = useState<FiltroVista>('por_atender');
  const [canales, setCanales] = useState<ReadonlySet<Canal>>(new Set());
  const [busqueda, setBusqueda] = useState('');

  const resumen = useMemo(() => resumir(conversaciones), [conversaciones]);
  const visibles = useMemo(
    () =>
      ordenarConversaciones(
        filtrarConversaciones(conversaciones, vista, canales, busqueda),
      ),
    [conversaciones, vista, canales, busqueda],
  );
  const porAtender = visibles.filter((c) => c.estado === 'derivado');
  const conBot = visibles.filter((c) => c.estado === 'bot');

  const vistas: { id: FiltroVista; etiqueta: string; cantidad: number }[] = [
    { id: 'por_atender', etiqueta: 'Por atender', cantidad: resumen.porAtender },
    { id: 'todas', etiqueta: 'Todas', cantidad: resumen.total },
    { id: 'bot', etiqueta: 'Con el bot', cantidad: resumen.conBot },
  ];

  function alternarCanal(canal: Canal) {
    setCanales((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(canal)) siguiente.delete(canal);
      else siguiente.add(canal);
      return siguiente;
    });
  }

  // Flechas arriba/abajo recorren la lista sin salir del teclado.
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const filas = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-fila]'),
    );
    const actual = filas.indexOf(document.activeElement as HTMLButtonElement);
    if (actual === -1) return;
    e.preventDefault();
    const destino = e.key === 'ArrowDown' ? actual + 1 : actual - 1;
    filas[Math.min(filas.length - 1, Math.max(0, destino))]?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="relative">
          <label htmlFor="buscar-conversacion" className="sr-only">
            Buscar conversación por teléfono o número
          </label>
          <IconBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            id="buscar-conversacion"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por teléfono…"
            className={`h-11 w-full rounded-xl border border-zinc-300 bg-white pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${ANILLO}`}
          />
        </div>

        <div
          role="group"
          aria-label="Vista"
          className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
        >
          {vistas.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vista === v.id}
              onClick={() => setVista(v.id)}
              className={`flex min-h-10 flex-auto items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold whitespace-nowrap transition-colors ${ANILLO} ${
                vista === v.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {v.etiqueta}
              <span
                className={`rounded-full px-1.5 font-mono text-[10px] ${
                  v.id === 'por_atender' && v.cantidad > 0
                    ? 'bg-brand-orange text-zinc-950'
                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                }`}
              >
                {v.cantidad}
              </span>
            </button>
          ))}
        </div>

        <div role="group" aria-label="Canal" className="flex flex-wrap gap-2">
          {CANALES.map((canal) => {
            const activo = canales.has(canal);
            return (
              <button
                key={canal}
                type="button"
                aria-pressed={activo}
                onClick={() => alternarCanal(canal)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors ${ANILLO} ${
                  activo
                    ? 'border-[var(--accent-ink)] bg-brand-orange/10 text-zinc-900 dark:text-zinc-50'
                    : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <InsigniaCanal canal={canal} tamano="sm" />
                {ETIQUETA_CANAL[canal]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" onKeyDown={alTeclear}>
        {cargando ? (
          <div className="space-y-px" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <IconBandeja className="h-9 w-9 text-zinc-400" />
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">
              {vista === 'por_atender' && !busqueda && canales.size === 0
                ? 'Todo al día'
                : 'Sin resultados'}
            </p>
            <p className="max-w-[16rem] text-sm text-zinc-600 dark:text-zinc-400">
              {vista === 'por_atender' && !busqueda && canales.size === 0
                ? 'Ningún cliente está esperando al equipo. El bot atiende al resto.'
                : 'Prueba con otra vista, otro canal o borra la búsqueda.'}
            </p>
          </div>
        ) : vista === 'todas' && porAtender.length > 0 && conBot.length > 0 ? (
          <>
            <Seccion titulo="Esperan al equipo" cantidad={porAtender.length}>
              {porAtender.map((c) => (
                <Fila
                  key={c.id}
                  c={c}
                  activa={c.id === seleccionadoId}
                  ahora={ahora}
                  onSeleccionar={onSeleccionar}
                />
              ))}
            </Seccion>
            <Seccion titulo="Atiende el bot" cantidad={conBot.length}>
              {conBot.map((c) => (
                <Fila
                  key={c.id}
                  c={c}
                  activa={c.id === seleccionadoId}
                  ahora={ahora}
                  onSeleccionar={onSeleccionar}
                />
              ))}
            </Seccion>
          </>
        ) : (
          <ul className="divide-y divide-dashed divide-zinc-200 dark:divide-zinc-800">
            {visibles.map((c) => (
              <Fila
                key={c.id}
                c={c}
                activa={c.id === seleccionadoId}
                ahora={ahora}
                onSeleccionar={onSeleccionar}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
