'use client';

import { useState } from 'react';
import { formatPrecio } from '@/lib/formato';

export type AnuncioRendimiento = {
  anuncio_id: string;
  nombre: string;
  estado: string | null;
  miniatura_url: string | null;
  titulo: string | null;
  campana: string;
  gasto: number;
  impresiones: number;
  clics_enlace: number;
  ctr: number | null;
  conversaciones: number;
  costo_por_conversacion: number | null;
  frecuencia: number | null;
  pedidos: number;
};

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';
// Con menos gasto que esto el costo por conversación es puro azar.
const GASTO_MINIMO_ORDEN = 10000;

type Orden = 'gasto' | 'costo';

function pesos(valor: number | null): string {
  return valor === null ? '—' : formatPrecio(valor);
}

function ordenar(anuncios: AnuncioRendimiento[], orden: Orden): AnuncioRendimiento[] {
  if (orden === 'gasto') return anuncios;
  return [...anuncios].sort((a, b) => {
    const sinDato = (x: AnuncioRendimiento) =>
      x.costo_por_conversacion === null || x.gasto < GASTO_MINIMO_ORDEN;
    if (sinDato(a) !== sinDato(b)) return sinDato(a) ? 1 : -1;
    return (a.costo_por_conversacion ?? 0) - (b.costo_por_conversacion ?? 0);
  });
}

export default function RendimientoAnuncios({ anuncios }: { anuncios: AnuncioRendimiento[] }) {
  const [orden, setOrden] = useState<Orden>('gasto');
  if (anuncios.length === 0) return null;
  const filas = ordenar(anuncios, orden);

  return (
    <section aria-label="Rendimiento por anuncio" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Rendimiento por anuncio</h2>
        <div role="group" aria-label="Ordenar anuncios" className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {(
            [
              ['gasto', 'Más gasto'],
              ['costo', 'Menor costo por conversación'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={orden === valor}
              onClick={() => setOrden(valor)}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${ANILLO} ${
                orden === valor
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Las conversaciones las cuenta Meta e incluyen las que llegan al WhatsApp del local. Los
        anuncios con menos de {formatPrecio(GASTO_MINIMO_ORDEN)} de gasto van al final al ordenar por costo.
      </p>
      <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {filas.map((a) => (
          <li key={a.anuncio_id} className="flex gap-3 p-4">
            {a.miniatura_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- la miniatura viene del CDN de Meta, con su propia firma.
              <img src={a.miniatura_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <div aria-hidden className="h-14 w-14 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{a.nombre}</p>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                {a.campana}
                {a.titulo ? ` · ${a.titulo}` : ''}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-6">
                {[
                  ['Gasto', formatPrecio(a.gasto)],
                  ['Conversaciones', String(a.conversaciones)],
                  ['Costo por conversación', pesos(a.costo_por_conversacion)],
                  ['CTR', a.ctr === null ? '—' : `${a.ctr}%`],
                  ['Frecuencia diaria', a.frecuencia === null ? '—' : String(a.frecuencia)],
                  ['Pedidos del bot', String(a.pedidos)],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt className="text-[11px] text-zinc-600 dark:text-zinc-400">{etiqueta}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
