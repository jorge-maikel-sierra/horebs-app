'use client';

import BotonCopiar from '@/components/BotonCopiar';
import Panel from '@/components/informes/Panel';
import { numero, pct, pesos, type Metricas, type TableroAds } from '@/components/google-ads/google-ads.tipos';
import { formatPrecio } from '@/lib/formato';

function Comparativo({ titulo, m }: { titulo: string; m: Metricas }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">{titulo}</p>
      <p className="mt-1 text-lg font-extrabold text-zinc-900 tabular-nums dark:text-zinc-50">{formatPrecio(m.gasto)}</p>
      <p className="text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
        {m.clics} clics · CTR {pct(m.ctr)} · {numero(m.conversiones)} conv. · CPA {pesos(m.cpa)}
      </p>
    </div>
  );
}

export default function SeccionTerminos({ t }: { t: TableroAds }) {
  const x = t.terminos;
  // Formato de negativas de Google Ads: una por línea, en concordancia de frase.
  const negativas = x.candidatas_negativas.map((n) => `"${n}"`).join('\n');
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 @3xl:grid-cols-2">
        <Comparativo titulo="Búsquedas de marca (Horebs)" m={x.marca} />
        <Comparativo titulo="Búsquedas genéricas" m={x.generico} />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        La marca convierte mejor porque esa gente ya iba a comprar: juzga la campaña por las genéricas.
        {x.gasto_sin_termino !== null &&
          ` Google no muestra el término de ${pct(x.gasto_sin_termino)} del gasto (búsquedas de poco volumen).`}
      </p>

      <Panel
        titulo="Candidatas a negativa"
        subtitulo="Términos sin conversiones, con 3 clics o más, que no son de marca"
        accion={negativas ? <BotonCopiar texto={negativas} /> : undefined}
      >
        {x.candidatas_negativas.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nada por excluir con los datos de este período.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {x.candidatas_negativas.map((n) => (
              <li key={n} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {n}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Antes de excluir, revisa que no sea alguien buscando pizza a domicilio con otras palabras.
        </p>
      </Panel>

      <Panel titulo="Búsquedas que activaron los anuncios" subtitulo="Las 50 de más gasto">
        {x.lista.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin búsquedas con datos en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th scope="col" className="py-2 pr-3 font-semibold">Búsqueda</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Gasto</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Clics</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">CTR</th>
                  <th scope="col" className="py-2 text-right font-semibold">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {x.lista.map((b) => (
                  <tr key={b.termino} className="text-zinc-800 dark:text-zinc-200">
                    <td className="py-2 pr-3">
                      {b.termino}
                      {b.marca && <span className="ml-2 rounded bg-blue-100 px-1.5 text-[11px] font-semibold text-brand-navy dark:bg-blue-400/15 dark:text-blue-300">marca</span>}
                      {b.candidata_negativa && <span className="ml-2 rounded bg-red-100 px-1.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">negativa</span>}
                      {b.estado === 'EXCLUDED' && <span className="ml-2 text-[11px] text-zinc-500">ya excluida</span>}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatPrecio(b.gasto)}</td>
                    <td className="py-2 pr-3 text-right">{b.clics}</td>
                    <td className="py-2 pr-3 text-right">{pct(b.ctr)}</td>
                    <td className="py-2 text-right">{numero(b.conversiones)}</td>
                  </tr>
                ))}
                {x.resto.terminos > 0 && (
                  <tr className="text-zinc-500 dark:text-zinc-400">
                    <td className="py-2 pr-3">Otras {x.resto.terminos} búsquedas</td>
                    <td className="py-2 pr-3 text-right">{formatPrecio(x.resto.gasto)}</td>
                    <td className="py-2 pr-3 text-right">{x.resto.clics}</td>
                    <td className="py-2 pr-3 text-right">{pct(x.resto.ctr)}</td>
                    <td className="py-2 text-right">{numero(x.resto.conversiones)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
