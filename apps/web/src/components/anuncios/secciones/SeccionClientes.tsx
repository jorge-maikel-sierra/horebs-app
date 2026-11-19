'use client';

import { useState } from 'react';
import { formatPrecio } from '@/lib/formato';
import {
  pesos,
  veces,
  type CohorteCampana,
  type Cohortes,
  type MetricasCohorte,
} from '@/components/anuncios/anuncios.tipos';

const VENTANAS = [30, 60, 90] as const;

// Rampa secuencial de un solo tono (azul validado de la guía de dataviz):
// en claro el cero se funde con el blanco; en oscuro, con el fondo oscuro.
// El texto cambia de tinta donde el fondo lo pide para mantener contraste.
const ESCALA = [
  'bg-[#cde2fb] text-zinc-900 dark:bg-[#0d366b] dark:text-zinc-50',
  'bg-[#9ec5f4] text-zinc-900 dark:bg-[#184f95] dark:text-zinc-50',
  'bg-[#6da7ec] text-zinc-900 dark:bg-[#2a78d6] dark:text-white',
  'bg-[#2a78d6] text-white dark:bg-[#6da7ec] dark:text-zinc-900',
  'bg-[#184f95] text-white dark:bg-[#b7d3f6] dark:text-zinc-900',
];

type Vista = 'campana' | 'mes';

function pctRecompra(m: MetricasCohorte, dias: number): number | null {
  return m.recompra.find((r) => r.dias === dias)?.pct ?? null;
}

function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  if (!a || !m) return mes;
  const texto = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(a, m - 1, 1)),
  );
  return texto.replace('.', '').replace(' de ', ' ');
}

function CeldaCalor({ pct, max, dias }: { pct: number | null; max: number; dias: number }) {
  if (pct === null) {
    return (
      <td className="p-1">
        <span
          title={`Todavía no cumplen ${dias} días desde su primera compra`}
          className="flex h-10 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
        >
          —
        </span>
      </td>
    );
  }
  const paso = max > 0 ? Math.min(ESCALA.length - 1, Math.floor((pct / max) * (ESCALA.length - 0.001))) : 0;
  return (
    <td className="p-1">
      <span className={`flex h-10 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${ESCALA[paso]}`}>
        {pct}%
      </span>
    </td>
  );
}

type Fila = { clave: string; titulo: string; m: MetricasCohorte; campana?: CohorteCampana };

const TH = 'px-3 py-2 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-2 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300';

function TablaCohortes({ filas, conCampana }: { filas: Fila[]; conCampana: boolean }) {
  const max = Math.max(0, ...filas.flatMap((f) => VENTANAS.map((d) => pctRecompra(f.m, d) ?? 0)));
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className={`w-full border-collapse ${conCampana ? 'min-w-[60rem]' : 'min-w-[44rem]'}`}>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <th scope="col" className="sticky left-0 z-10 bg-zinc-50 px-4 py-2 text-left text-xs font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              {conCampana ? 'Campaña' : 'Primera compra'}
            </th>
            <th scope="col" className={TH}>Clientes</th>
            {VENTANAS.map((d) => (
              <th key={d} scope="col" className="w-20 px-1 py-2 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {d} días
              </th>
            ))}
            <th scope="col" className={TH}>Días a la 2.ª</th>
            <th scope="col" className={TH}>Pedidos por cliente</th>
            <th scope="col" className={TH}>Han pagado</th>
            {conCampana && (
              <>
                <th scope="col" className={TH}>Gasto</th>
                <th scope="col" className={TH}>Costo por cliente</th>
                <th scope="col" className={TH}>Pagado ÷ gasto</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
              <th
                scope="row"
                title={f.titulo}
                className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-sm font-semibold text-zinc-900 shadow-[1px_0_0_var(--color-zinc-200)] dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[1px_0_0_var(--color-zinc-800)]"
              >
                <div className="max-w-[13rem] truncate">{f.titulo}</div>
              </th>
              <td className={`${TD} font-semibold text-zinc-900 dark:text-zinc-50`}>{f.m.clientes}</td>
              {VENTANAS.map((d) => (
                <CeldaCalor key={d} dias={d} pct={pctRecompra(f.m, d)} max={max} />
              ))}
              <td className={TD}>{f.m.dias_a_segunda ?? '—'}</td>
              <td className={TD}>{f.m.pedidos_por_cliente ?? '—'}</td>
              <td className={TD}>{formatPrecio(f.m.valor)}</td>
              {f.campana && (
                <>
                  <td className={TD}>{formatPrecio(f.campana.gasto)}</td>
                  <td className={TD}>{pesos(f.campana.costo_por_cliente_nuevo)}</td>
                  <td className={`${TD} font-bold text-zinc-900 dark:text-zinc-50`}>{veces(f.campana.valor_sobre_gasto)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">
      <span>Menos vuelven</span>
      <span className="flex gap-0.5">
        {ESCALA.map((c) => (
          <span key={c} className={`h-3 w-5 rounded-sm ${c.split(' ').filter((x) => x.includes('bg-')).join(' ')}`} />
        ))}
      </span>
      <span>Más vuelven</span>
    </div>
  );
}

export default function SeccionClientes({ datos }: { datos: Cohortes }) {
  const [vista, setVista] = useState<Vista>(datos.por_campana.length > 0 ? 'campana' : 'mes');
  const ligados = datos.clientes_nuevos > 0 ? Math.round((datos.clientes_atribuidos / datos.clientes_nuevos) * 100) : 0;

  const filas: Fila[] =
    vista === 'campana'
      ? datos.por_campana.map((c) => ({ clave: c.campana_id, titulo: c.nombre, m: c, campana: c }))
      : datos.por_mes.map((m) => ({ clave: m.mes, titulo: nombreMes(m.mes), m }));

  return (
    <div className="animate-fade-up mt-5">
      <div className="grid gap-3 @2xl:grid-cols-[1fr_auto] @2xl:items-end">
        <dl className="grid grid-cols-2 gap-3 @2xl:flex @2xl:gap-8">
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Clientes nuevos</dt>
            <dd className="text-3xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
              {datos.clientes_nuevos}
            </dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Ligados a una campaña ({datos.clientes_atribuidos})
            </dt>
            <dd className="text-3xl font-extrabold tracking-tight text-accent-ink tabular-nums">{ligados}%</dd>
          </div>
        </dl>
        <div role="radiogroup" aria-label="Agrupar clientes por" className="flex justify-self-start rounded-lg bg-zinc-100 p-0.5 @2xl:justify-self-end dark:bg-zinc-800/70">
          {(
            [
              ['campana', 'Por campaña'],
              ['mes', 'Por mes'],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={vista === clave}
              onClick={() => setVista(clave)}
              className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
                vista === clave
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">¿Cuántos vuelven a comprar?</h2>
        <Leyenda />
      </div>

      {filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {vista === 'campana'
            ? 'Todavía no hay clientes nuevos ligados a una campaña en este rango.'
            : 'Todavía no hay clientes con primera compra en este rango.'}
        </p>
      ) : (
        <TablaCohortes key={vista} filas={filas} conCampana={vista === 'campana'} />
      )}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        El porcentaje de cada columna solo cuenta a los clientes que ya cumplieron esos días desde su primera compra
        (— si ninguno los cumple). Los pedidos de WooCommerce no están en la plataforma: la primera compra es la primera
        desde {datos.primera_compra_desde ?? 'el inicio'}.
      </p>
    </div>
  );
}
