'use client';

import { useState } from 'react';
import { formatPrecio } from '@/lib/formato';
import { pesos, porcentaje, veces, type Campana } from '@/components/anuncios/anuncios.tipos';

type Columna = {
  clave: string;
  etiqueta: string;
  /** Valor para ordenar; null siempre va al final. */
  valor: (c: Campana) => number | null;
  texto: (c: Campana) => string;
  /** En los costos, menos es mejor: el primer clic ordena de menor a mayor. */
  menorEsMejor?: boolean;
};

const utilidad = (c: Campana) => (c.cobertura_costos ? c.utilidad_bruta : null);

const COLUMNAS: Columna[] = [
  { clave: 'gasto', etiqueta: 'Gasto', valor: (c) => c.gasto, texto: (c) => formatPrecio(c.gasto) },
  { clave: 'ventas', etiqueta: 'Ventas', valor: (c) => c.ventas, texto: (c) => formatPrecio(c.ventas) },
  { clave: 'roas', etiqueta: 'Retorno', valor: (c) => c.roas, texto: (c) => veces(c.roas) },
  { clave: 'pedidos', etiqueta: 'Pedidos', valor: (c) => c.pedidos, texto: (c) => String(c.pedidos) },
  {
    clave: 'costo_por_pedido',
    etiqueta: 'Costo por pedido',
    valor: (c) => c.costo_por_pedido,
    texto: (c) => pesos(c.costo_por_pedido),
    menorEsMejor: true,
  },
  {
    clave: 'conversaciones',
    etiqueta: 'Conversaciones',
    valor: (c) => c.conversaciones,
    texto: (c) => String(c.conversaciones),
  },
  {
    clave: 'costo_por_conversacion',
    etiqueta: 'Costo por conversación',
    valor: (c) => c.costo_por_conversacion,
    texto: (c) => pesos(c.costo_por_conversacion),
    menorEsMejor: true,
  },
  {
    clave: 'clientes_nuevos',
    etiqueta: 'Clientes nuevos',
    valor: (c) => c.clientes_nuevos,
    texto: (c) => String(c.clientes_nuevos),
  },
  {
    clave: 'costo_por_cliente_nuevo',
    etiqueta: 'Costo por cliente nuevo',
    valor: (c) => c.costo_por_cliente_nuevo,
    texto: (c) => pesos(c.costo_por_cliente_nuevo),
    menorEsMejor: true,
  },
  { clave: 'utilidad', etiqueta: 'Utilidad bruta', valor: utilidad, texto: (c) => pesos(utilidad(c)) },
  {
    clave: 'retorno_utilidad',
    etiqueta: 'Retorno sobre utilidad',
    valor: (c) => c.retorno_utilidad,
    texto: (c) => veces(c.retorno_utilidad),
  },
  {
    clave: 'frecuencia',
    etiqueta: 'Frecuencia diaria',
    valor: (c) => c.frecuencia,
    texto: (c) => (c.frecuencia === null ? '—' : String(c.frecuencia)),
  },
  {
    clave: 'cobertura_costos',
    etiqueta: 'Costos cargados',
    valor: (c) => c.cobertura_costos,
    texto: (c) => porcentaje(c.cobertura_costos),
  },
];

/** Las cuatro que responden "¿esta campaña sirve?"; el resto va en el detalle. */
const CLAVE_TARJETA = ['gasto', 'pedidos', 'costo_por_pedido', 'roas'];
const ORDEN_TELEFONO = ['gasto', 'roas', 'pedidos'];

type Orden = { clave: string; asc: boolean };

function ordenar(campanas: Campana[], orden: Orden): Campana[] {
  const col = COLUMNAS.find((c) => c.clave === orden.clave) ?? COLUMNAS[0];
  return [...campanas].sort((a, b) => {
    const va = col.valor(a);
    const vb = col.valor(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return orden.asc ? va - vb : vb - va;
  });
}

function Tarjeta({ c }: { c: Campana }) {
  const principales = COLUMNAS.filter((col) => CLAVE_TARJETA.includes(col.clave));
  const resto = COLUMNAS.filter((col) => !CLAVE_TARJETA.includes(col.clave));
  return (
    <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{c.nombre}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {principales.map((col) => (
          <div key={col.clave} className="flex flex-col-reverse">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{col.etiqueta}</dt>
            <dd
              className={`font-extrabold tabular-nums ${
                col.clave === 'roas' ? 'text-xl text-accent-ink' : 'text-lg text-zinc-900 dark:text-zinc-50'
              }`}
            >
              {col.texto(c)}
            </dd>
          </div>
        ))}
      </dl>
      <details className="group mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
          Ver detalle
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="transition-transform duration-200 group-open:rotate-180">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-1">
          {resto.map((col) => (
            <div key={col.clave} className="flex flex-col-reverse">
              <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{col.etiqueta}</dt>
              <dd className="text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{col.texto(c)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}

function Flecha({ asc }: { asc: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className={asc ? 'rotate-180' : ''}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function Tabla({ filas, orden, onOrden }: { filas: Campana[]; orden: Orden; onOrden: (clave: string) => void }) {
  const total = (f: (c: Campana) => number) => filas.reduce((s, c) => s + f(c), 0);
  const totales: Record<string, string> = {
    gasto: formatPrecio(total((c) => c.gasto)),
    ventas: formatPrecio(total((c) => c.ventas)),
    pedidos: String(total((c) => c.pedidos)),
    conversaciones: String(total((c) => c.conversaciones)),
    clientes_nuevos: String(total((c) => c.clientes_nuevos)),
  };
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th scope="col" className="sticky left-0 z-10 bg-zinc-50 px-4 py-2 text-left font-semibold dark:bg-zinc-900">
              Campaña
            </th>
            {COLUMNAS.map((col) => {
              const activa = orden.clave === col.clave;
              return (
                <th
                  key={col.clave}
                  scope="col"
                  aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : 'none'}
                  className="px-1 py-1 text-right align-bottom font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => onOrden(col.clave)}
                    className={`inline-flex min-h-9 items-center justify-end gap-1 rounded-md px-2 text-right leading-tight transition-colors hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none dark:hover:text-zinc-100 ${
                      activa ? 'text-zinc-900 dark:text-zinc-50' : ''
                    }`}
                  >
                    {activa && <Flecha asc={orden.asc} />}
                    {col.etiqueta}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.campana_id} className="group border-b border-zinc-100 last:border-0 dark:border-zinc-800/70">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold text-zinc-900 shadow-[1px_0_0_var(--color-zinc-200)] transition-colors group-hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-[1px_0_0_var(--color-zinc-800)] dark:group-hover:bg-zinc-900"
                title={c.nombre}
              >
                {/* truncate en un div: una celda de tabla ignora max-width y se desborda. */}
                <div className="max-w-[15rem] truncate">{c.nombre}</div>
              </th>
              {COLUMNAS.map((col) => (
                <td
                  key={col.clave}
                  className={`px-3 py-3 text-right tabular-nums transition-colors group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900 ${
                    orden.clave === col.clave
                      ? 'font-bold text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {col.texto(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {filas.length > 1 && (
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
              <th scope="row" className="sticky left-0 z-10 bg-zinc-50 px-4 py-2.5 text-left font-semibold dark:bg-zinc-900">
                Total
              </th>
              {COLUMNAS.map((col) => (
                <td key={col.clave} className="px-3 py-2.5 text-right font-bold tabular-nums">
                  {totales[col.clave] ?? ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function SeccionCampanas({ campanas }: { campanas: Campana[] }) {
  const [orden, setOrden] = useState<Orden>({ clave: 'gasto', asc: false });
  const filas = ordenar(campanas, orden);

  function cambiarOrden(clave: string) {
    const col = COLUMNAS.find((c) => c.clave === clave);
    setOrden((o) =>
      o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: Boolean(col?.menorEsMejor) },
    );
  }

  if (campanas.length === 0) {
    return (
      <div className="animate-fade-up mt-5 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sin campañas con gasto en este rango</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Sincroniza con Meta para traer el gasto de cada campaña.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up mt-5">
      <div className="mb-3 flex items-center justify-between gap-3 @3xl:hidden">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{campanas.length} campañas</p>
        <div role="radiogroup" aria-label="Ordenar campañas por" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70">
          {COLUMNAS.filter((c) => ORDEN_TELEFONO.includes(c.clave)).map((col) => {
            const { clave } = col;
            const sel = orden.clave === clave;
            return (
              <button
                key={clave}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setOrden({ clave, asc: false })}
                className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
                  sel
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {col.etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="grid gap-3 @xl:grid-cols-2 @3xl:hidden">
        {filas.map((c) => (
          <Tarjeta key={c.campana_id} c={c} />
        ))}
      </ul>

      <div className="hidden @3xl:block">
        <Tabla filas={filas} orden={orden} onOrden={cambiarOrden} />
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        El retorno de cada campaña solo cuenta los pedidos que se le pudieron atribuir. La utilidad sale de los
        costos cargados en Costos y margen.
      </p>
    </div>
  );
}
