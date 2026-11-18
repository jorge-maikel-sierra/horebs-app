'use client';

import { useCallback, useEffect, useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatPrecio } from '@/lib/formato';
import CohortesRecompra from '@/components/anuncios/CohortesRecompra';
import PublicosMeta from '@/components/anuncios/PublicosMeta';
import RendimientoAnuncios, {
  type AnuncioRendimiento,
} from '@/components/anuncios/RendimientoAnuncios';

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

type Campana = {
  campana_id: string;
  nombre: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversaciones: number;
  costo_por_conversacion: number | null;
  frecuencia: number | null;
  pedidos: number;
  ventas: number;
  clientes_nuevos: number;
  costo_por_pedido: number | null;
  costo_por_cliente_nuevo: number | null;
  roas: number | null;
  utilidad_bruta: number;
  cobertura_costos: number | null;
  retorno_utilidad: number | null;
};

type General = {
  gasto_total: number;
  ventas_totales: number;
  pedidos_totales: number;
  pedidos_atribuidos: number;
  roas_general: number | null;
  utilidad_bruta: number;
  margen_pct: number | null;
  cobertura_costos: number | null;
  utilidad_tras_anuncios: number | null;
};

type Tablero = {
  desde: string;
  origenes: Origen[];
  general: General;
  campanas: Campana[];
  anuncios: AnuncioRendimiento[];
  gasto_hasta: string | null;
};

type Sincronizacion = { estado: 'sincronizado' | 'apagado'; filas: number };

function veces(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('es-CO')}x`;
}

function pesos(valor: number | null): string {
  return valor === null ? '—' : formatPrecio(valor);
}

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
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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

  async function sincronizar() {
    setSincronizando(true);
    setAviso(null);
    try {
      const res = await adminFetch('/admin/anuncios/sincronizaciones', { method: 'POST' });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo sincronizar con Meta.'));
      const r = (await res.json()) as Sincronizacion;
      setAviso(
        r.estado === 'apagado'
          ? 'Meta no está conectado: faltan META_AD_ACCOUNT_ID y el token con permiso ads_read en Railway.'
          : `Listo: ${r.filas} filas de gasto al día.`,
      );
      await cargar(dias);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'No se pudo sincronizar con Meta.');
    } finally {
      setSincronizando(false);
    }
  }

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
          {tablero && (
            <section aria-label="Gasto y retorno" className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Gasto y retorno
                </h2>
                <button
                  type="button"
                  onClick={() => void sincronizar()}
                  disabled={sincronizando}
                  className={`min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900 ${ANILLO}`}
                >
                  {sincronizando ? 'Sincronizando…' : 'Sincronizar con Meta'}
                </button>
              </div>
              {aviso && (
                <p role="status" className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {aviso}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Cifra etiqueta="Gasto en anuncios" valor={formatPrecio(tablero.general.gasto_total)} />
                <Cifra etiqueta="Ventas de todos los canales" valor={formatPrecio(tablero.general.ventas_totales)} />
                <Cifra etiqueta="Retorno general" valor={veces(tablero.general.roas_general)} />
                <Cifra
                  etiqueta="Pedidos atribuidos"
                  valor={`${tablero.general.pedidos_atribuidos} de ${tablero.general.pedidos_totales}`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Cifra
                  etiqueta="Utilidad bruta"
                  valor={tablero.general.cobertura_costos ? formatPrecio(tablero.general.utilidad_bruta) : '—'}
                />
                <Cifra etiqueta="Utilidad tras anuncios" valor={pesos(tablero.general.utilidad_tras_anuncios)} />
                <Cifra
                  etiqueta="Margen"
                  valor={tablero.general.margen_pct === null ? '—' : `${tablero.general.margen_pct}%`}
                />
                <Cifra
                  etiqueta="Ventas con costo"
                  valor={tablero.general.cobertura_costos === null ? '—' : `${tablero.general.cobertura_costos}%`}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                La utilidad sale de los costos que cargas en Costos y margen; sin costos no hay utilidad.
              </p>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {tablero.gasto_hasta
                  ? `Gasto sincronizado hasta el ${tablero.gasto_hasta}. `
                  : 'Todavía no hay gasto de Meta sincronizado. '}
                El retorno general divide todas las ventas entre el gasto; el de cada campaña solo
                cuenta los pedidos que se le pudieron atribuir.
              </p>
              {tablero.campanas.length > 0 && (
                <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                  {tablero.campanas.map((c) => (
                    <li key={c.campana_id} className="p-4">
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{c.nombre}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-6">
                        {[
                          ['Gasto', formatPrecio(c.gasto)],
                          ['Conversaciones', String(c.conversaciones)],
                          ['Costo por conversación', pesos(c.costo_por_conversacion)],
                          ['Frecuencia', c.frecuencia === null ? '—' : String(c.frecuencia)],
                          ['Pedidos atribuidos', String(c.pedidos)],
                          ['Costo por pedido', pesos(c.costo_por_pedido)],
                          ['Clientes nuevos', String(c.clientes_nuevos)],
                          ['Retorno sobre ventas', veces(c.roas)],
                          ['Utilidad bruta', c.cobertura_costos ? formatPrecio(c.utilidad_bruta) : '—'],
                          ['Retorno sobre utilidad', veces(c.retorno_utilidad)],
                          ['Costos cargados', c.cobertura_costos === null ? '—' : `${c.cobertura_costos}%`],
                        ].map(([etiqueta, valor]) => (
                          <div key={etiqueta}>
                            <dt className="text-[11px] text-zinc-600 dark:text-zinc-400">{etiqueta}</dt>
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
            </section>
          )}

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

          <RendimientoAnuncios anuncios={tablero?.anuncios ?? []} />
          <CohortesRecompra desde={tablero?.desde ?? fechaHaceDias(dias)} />
          <PublicosMeta />
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
