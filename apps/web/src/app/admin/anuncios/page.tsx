'use client';

import { useCallback, useEffect, useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatPrecio } from '@/lib/formato';

type Origen = {
  clave: string;
  tipo: 'anuncio' | 'enlace' | 'otro';
  fuente: string;
  anuncio_id: string | null;
  ref: string | null;
  titulo: string | null;
  conversaciones: number;
  pedidos: number;
  entregados: number;
  cancelados: number;
  ventas: number;
};

type Tablero = { desde: string; origenes: Origen[] };

const RANGOS = [
  { dias: 7, etiqueta: '7 días' },
  { dias: 30, etiqueta: '30 días' },
  { dias: 90, etiqueta: '90 días' },
] as const;

const MS_POR_DIA = 86_400_000;
const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';

/** Fecha AAAA-MM-DD en Bogotá de hace `dias` días (el negocio opera en UTC-5). */
function fechaHaceDias(dias: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(Date.now() - dias * MS_POR_DIA),
  );
}

function nombreOrigen(o: Origen): string {
  if (o.tipo === 'anuncio') return o.titulo ?? `Anuncio ${o.anuncio_id}`;
  if (o.tipo === 'enlace') return `Enlace «${o.ref}»`;
  return o.fuente === 'desconocida' ? 'Sin dato' : o.fuente;
}

function detalleOrigen(o: Origen): string {
  if (o.tipo === 'anuncio') return `Anuncio · id ${o.anuncio_id}`;
  if (o.tipo === 'enlace') return 'Enlace m.me / ig.me con ref';
  return 'Otro origen';
}

function conversion(o: Origen): string {
  if (o.conversaciones === 0) return '—';
  const pct = Math.round(((o.pedidos - o.cancelados) / o.conversaciones) * 100);
  return `${Math.max(pct, 0)}%`;
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {valor}
      </p>
    </div>
  );
}

function TableroAnuncios() {
  const [dias, setDias] = useState<number>(30);
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (rango: number) => {
    setCargando(true);
    try {
      const res = await adminFetch(`/admin/anuncios?desde=${fechaHaceDias(rango)}`);
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo cargar el tablero.'));
      setTablero(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el tablero.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void cargar(dias), 0);
    return () => clearTimeout(id);
  }, [cargar, dias]);

  const origenes = tablero?.origenes ?? [];
  const totales = origenes.reduce(
    (t, o) => ({
      conversaciones: t.conversaciones + o.conversaciones,
      pedidos: t.pedidos + o.pedidos - o.cancelados,
      ventas: t.ventas + o.ventas,
    }),
    { conversaciones: 0, pedidos: 0, ventas: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Ventas por anuncio
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Conversaciones y pedidos del bot de Messenger, Instagram y WhatsApp según el anuncio
            o el enlace del que llegó el cliente. Los pedidos cancelados no suman a las ventas.
          </p>
        </div>
        <div role="group" aria-label="Rango de fechas" className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {RANGOS.map((r) => (
            <button
              key={r.dias}
              type="button"
              aria-pressed={dias === r.dias}
              onClick={() => setDias(r.dias)}
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${ANILLO} ${
                dias === r.dias
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {r.etiqueta}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {cargando && !tablero ? (
        <CargandoSkeleton filas={5} />
      ) : (
        <>
          <section aria-label="Totales" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Cifra etiqueta="Conversaciones" valor={String(totales.conversaciones)} />
            <Cifra etiqueta="Pedidos" valor={String(totales.pedidos)} />
            <Cifra etiqueta="Ventas" valor={formatPrecio(totales.ventas)} />
          </section>

          {origenes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Todavía no hay datos en este rango
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                Aparecen cuando alguien escribe al bot desde un anuncio o desde un enlace m.me /
                ig.me con ref (por ejemplo el QR de la caja).
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {origenes.map((o) => (
                <li key={o.clave} className="grid gap-3 p-4 sm:grid-cols-[1fr_repeat(4,6.5rem)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                      {nombreOrigen(o)}
                    </p>
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                      {detalleOrigen(o)}
                    </p>
                  </div>
                  <dl className="contents">
                    {[
                      ['Conversaciones', String(o.conversaciones)],
                      ['Pedidos', String(o.pedidos - o.cancelados)],
                      ['Conversión', conversion(o)],
                      ['Ventas', formatPrecio(o.ventas)],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="flex justify-between gap-2 sm:block sm:text-right">
                        <dt className="text-xs text-zinc-600 sm:hidden dark:text-zinc-400">
                          {etiqueta}
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {valor}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Conversaciones por su primer anuncio o enlace; pedidos por el último antes de pedir.
          </p>
        </>
      )}
    </div>
  );
}

export default function AnunciosPage() {
  return (
    <RequireRol roles={['admin']}>
      <TableroAnuncios />
    </RequireRol>
  );
}
