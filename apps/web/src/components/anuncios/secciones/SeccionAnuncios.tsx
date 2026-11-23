'use client';

import { useState } from 'react';
import { formatPrecio } from '@/lib/formato';
import { pesos, type AnuncioRendimiento } from '@/components/anuncios/anuncios.tipos';

// Con menos gasto que esto el costo por conversación es puro azar.
const GASTO_MINIMO_ORDEN = 10000;

type Orden = 'gasto' | 'costo';

const ORDENES: { key: Orden; label: string }[] = [
  { key: 'gasto', label: 'Más gasto' },
  { key: 'costo', label: 'Menor costo' },
];

// effective_status de Meta; lo que no esté aquí no se muestra.
const ESTADOS: Record<string, { texto: string; activo: boolean }> = {
  ACTIVE: { texto: 'Activo', activo: true },
  PAUSED: { texto: 'Pausado', activo: false },
  CAMPAIGN_PAUSED: { texto: 'Campaña pausada', activo: false },
  ADSET_PAUSED: { texto: 'Conjunto pausado', activo: false },
  ARCHIVED: { texto: 'Archivado', activo: false },
  DELETED: { texto: 'Eliminado', activo: false },
  PENDING_REVIEW: { texto: 'En revisión', activo: false },
  DISAPPROVED: { texto: 'Rechazado', activo: false },
  WITH_ISSUES: { texto: 'Con problemas', activo: false },
};

const poco = (a: AnuncioRendimiento) => a.costo_por_conversacion === null || a.gasto < GASTO_MINIMO_ORDEN;

function ordenar(anuncios: AnuncioRendimiento[], orden: Orden): AnuncioRendimiento[] {
  if (orden === 'gasto') return [...anuncios].sort((a, b) => b.gasto - a.gasto);
  return [...anuncios].sort((a, b) => {
    if (poco(a) !== poco(b)) return poco(a) ? 1 : -1;
    return (a.costo_por_conversacion ?? 0) - (b.costo_por_conversacion ?? 0);
  });
}

function EstadoChip({ estado }: { estado: string | null }) {
  const e = estado ? ESTADOS[estado] : undefined;
  if (!e) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur-sm dark:bg-zinc-900/85 dark:text-zinc-100">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${e.activo ? 'bg-green-500' : 'bg-zinc-400'}`} />
      {e.texto}
    </span>
  );
}

function Miniatura({ a }: { a: AnuncioRendimiento }) {
  return (
    <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 @xl:w-full @xl:rounded-none dark:bg-zinc-800">
      {a.miniatura_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- la miniatura viene del CDN de Meta, con su propia firma.
        <img
          src={a.miniatura_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div aria-hidden="true" className="flex h-full items-center justify-center text-zinc-300 dark:text-zinc-600">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
        </div>
      )}
      <div className="absolute top-2 left-2 hidden @xl:block">
        <EstadoChip estado={a.estado} />
      </div>
    </div>
  );
}

function Titulos({ a }: { a: AnuncioRendimiento }) {
  return (
    <>
      <p className="line-clamp-2 leading-snug font-semibold text-zinc-900 dark:text-zinc-50" title={a.nombre}>
        {a.nombre}
      </p>
      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
        {a.campana}
        {a.titulo ? ` · ${a.titulo}` : ''}
      </p>
    </>
  );
}

function TarjetaAnuncio({ a, puesto }: { a: AnuncioRendimiento; puesto: number }) {
  const secundarias = [
    ['Gasto', formatPrecio(a.gasto)],
    ['Conversaciones', String(a.conversaciones)],
    ['Pedidos del bot', String(a.pedidos)],
  ];
  return (
    <li
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 p-3 transition-shadow hover:shadow-md @xl:p-0 dark:border-zinc-800"
      style={{ animationDelay: `${Math.min(puesto, 8) * 40}ms` }}
    >
      {/* Teléfono: miniatura y nombre lado a lado. Desde tablet: la imagen arriba, a todo el ancho. */}
      <div className="flex gap-3 @xl:block">
        <Miniatura a={a} />
        <div className="min-w-0 flex-1 @xl:hidden">
          <div className="mb-1">
            <EstadoChip estado={a.estado} />
          </div>
          <Titulos a={a} />
        </div>
      </div>
      <div className="mt-3 @xl:mt-0 @xl:p-4">
        <div className="hidden @xl:block">
          <Titulos a={a} />
        </div>
        <div className="flex items-end justify-between gap-2 @xl:mt-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Costo por conversación
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
              {pesos(a.costo_por_conversacion)}
            </p>
          </div>
          {poco(a) && (
            <span
              title={`Con menos de ${formatPrecio(GASTO_MINIMO_ORDEN)} de gasto el costo todavía no es confiable`}
              className="mb-1 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Poco gasto
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {secundarias.map(([e, v]) => (
            <div key={e} className="flex min-w-0 flex-col-reverse">
              <dt className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{e}</dt>
              <dd className="text-sm font-bold text-zinc-900 tabular-nums dark:text-zinc-50">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
          CTR {a.ctr === null ? '—' : `${a.ctr}%`} · Frecuencia {a.frecuencia ?? '—'}
        </p>
      </div>
    </li>
  );
}

export default function SeccionAnuncios({ anuncios }: { anuncios: AnuncioRendimiento[] }) {
  const [orden, setOrden] = useState<Orden>('gasto');
  const [soloActivos, setSoloActivos] = useState(false);
  const hayActivos = anuncios.some((a) => a.estado === 'ACTIVE');
  const visibles = soloActivos ? anuncios.filter((a) => a.estado === 'ACTIVE') : anuncios;
  const filas = ordenar(visibles, orden);

  if (anuncios.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sin anuncios con gasto en este rango</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Sincroniza con Meta para traer el rendimiento de cada anuncio.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Ordenar anuncios por" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70">
          {ORDENES.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={orden === o.key}
              onClick={() => setOrden(o.key)}
              className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
                orden === o.key
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {hayActivos && (
          <button
            type="button"
            aria-pressed={soloActivos}
            onClick={() => setSoloActivos((v) => !v)}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
              soloActivos
                ? 'border-green-600/40 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-400'
                : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300'
            }`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${soloActivos ? 'bg-green-500' : 'bg-zinc-400'}`} />
            Solo activos
          </button>
        )}
      </div>

      {/* key: al cambiar orden o filtro la galería se vuelve a revelar en cascada. */}
      <ul key={`${orden}-${soloActivos}`} className="grid gap-3 @xl:grid-cols-2 @xl:gap-4 @4xl:grid-cols-3 @6xl:grid-cols-4">
        {filas.map((a, i) => (
          <TarjetaAnuncio key={a.anuncio_id} a={a} puesto={i} />
        ))}
      </ul>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Las conversaciones las cuenta Meta e incluyen las que llegan al WhatsApp del local. Al ordenar por costo, los
        anuncios con menos de {formatPrecio(GASTO_MINIMO_ORDEN)} de gasto van al final.
      </p>
    </div>
  );
}
