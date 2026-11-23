'use client';

import Panel from '@/components/informes/Panel';
import {
  etiqueta,
  numero,
  pct,
  pesos,
  type AnuncioAds,
  type Palabra,
  type TableroAds,
} from '@/components/google-ads/google-ads.tipos';
import { formatPrecio } from '@/lib/formato';

const QS_BAJO = 4;

function Qs({ p }: { p: Palabra }) {
  if (p.qs === null) return <span className="text-zinc-400">—</span>;
  const bajo = p.qs <= QS_BAJO;
  return (
    <span
      className={`font-bold tabular-nums ${bajo ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'}`}
      title={`CTR esperado: ${etiqueta(p.qs_ctr)} · Relevancia: ${etiqueta(p.qs_anuncio)} · Página: ${etiqueta(p.qs_pagina)}`}
    >
      {p.qs}/10
    </span>
  );
}

function Tasa({ valor, suficiente }: { valor: string; suficiente: boolean }) {
  return (
    <span className={suficiente ? '' : 'text-zinc-400 dark:text-zinc-500'} title={suficiente ? undefined : 'Muestra insuficiente'}>
      {valor}
      {!suficiente && valor !== '—' && <span aria-label="muestra insuficiente">*</span>}
    </span>
  );
}

function TablaPalabras({ palabras }: { palabras: Palabra[] }) {
  return (
    <>
      <ul className="space-y-3 @2xl:hidden">
        {palabras.map((p) => (
          <li key={p.clave} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.texto}</p>
              <Qs p={p} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {etiqueta(p.concordancia)} · {etiqueta(p.estado)}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm tabular-nums">
              <div><dt className="text-xs text-zinc-500">Gasto</dt><dd className="font-semibold">{formatPrecio(p.gasto)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Clics</dt><dd className="font-semibold">{p.clics}</dd></div>
              <div><dt className="text-xs text-zinc-500">Conv.</dt><dd className="font-semibold">{numero(p.conversiones)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto @2xl:block">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th scope="col" className="py-2 pr-3 font-semibold">Palabra</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Concordancia</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Gasto</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Impr.</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Clics</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">CTR</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">CPC</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Conv.</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">CPA</th>
              <th scope="col" className="py-2 text-right font-semibold">Calidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {palabras.map((p) => (
              <tr key={p.clave} className="text-zinc-800 dark:text-zinc-200">
                <td className="py-2 pr-3 font-medium">
                  {p.texto}
                  {p.estado !== 'ENABLED' && <span className="ml-1 text-xs text-zinc-500">({etiqueta(p.estado)})</span>}
                </td>
                <td className="py-2 pr-3">{etiqueta(p.concordancia)}</td>
                <td className="py-2 pr-3 text-right">{formatPrecio(p.gasto)}</td>
                <td className="py-2 pr-3 text-right">{p.impresiones}</td>
                <td className="py-2 pr-3 text-right">{p.clics}</td>
                <td className="py-2 pr-3 text-right"><Tasa valor={pct(p.ctr)} suficiente={p.muestra.ctr} /></td>
                <td className="py-2 pr-3 text-right">{pesos(p.cpc)}</td>
                <td className="py-2 pr-3 text-right">{numero(p.conversiones)}</td>
                <td className="py-2 pr-3 text-right"><Tasa valor={pesos(p.cpa)} suficiente={p.muestra.cpa} /></td>
                <td className="py-2 text-right"><Qs p={p} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Anuncios({ anuncios }: { anuncios: AnuncioAds[] }) {
  if (anuncios.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin anuncios sincronizados.</p>;
  }
  return (
    <ul className="space-y-3">
      {anuncios.map((a) => {
        const malo = a.aprobacion !== 'APPROVED' || a.fuerza === 'POOR' || a.fuerza === 'AVERAGE';
        return (
          <li key={`${a.grupo_id}-${a.anuncio_id}`} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">
              Anuncio {a.anuncio_id} <span className="font-normal text-zinc-500">· {etiqueta(a.estado)}</span>
            </p>
            <p className={malo ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}>
              Fuerza {etiqueta(a.fuerza)} · {etiqueta(a.aprobacion)}
            </p>
            <p className="mt-1 [overflow-wrap:anywhere] text-xs text-zinc-500 dark:text-zinc-400">{a.urls_finales.join(' · ')}</p>
          </li>
        );
      })}
    </ul>
  );
}

export default function SeccionPalabras({ t }: { t: TableroAds }) {
  return (
    <div className="mt-6 grid gap-6 @6xl:grid-cols-[2fr_1fr]">
      <Panel
        titulo="Palabras clave"
        subtitulo={`Ordenadas por gasto. * = muestra insuficiente (< ${t.muestra_minima.impresiones_ctr} impresiones para CTR, < ${t.muestra_minima.conversiones_cpa} conversiones para CPA). Pasa el cursor por la calidad para ver sus tres partes.`}
      >
        {t.palabras.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin palabras con datos en este período.</p>
        ) : (
          <TablaPalabras palabras={t.palabras} />
        )}
      </Panel>
      <Panel titulo="Anuncios" subtitulo="Fuerza, aprobación y página de destino">
        <Anuncios anuncios={t.anuncios} />
      </Panel>
    </div>
  );
}
