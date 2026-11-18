'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatPrecio } from '@/lib/formato';

type Ventana = { dias: number; elegibles: number; recompraron: number; pct: number | null };

type Metricas = {
  clientes: number;
  pedidos: number;
  valor: number;
  pedidos_por_cliente: number | null;
  recompra: Ventana[];
  dias_a_segunda: number | null;
};

type CohorteMes = Metricas & { mes: string };
type CohorteCampana = Metricas & {
  campana_id: string;
  nombre: string;
  gasto: number;
  costo_por_cliente_nuevo: number | null;
  valor_sobre_gasto: number | null;
};

type Cohortes = {
  desde: string;
  por_mes: CohorteMes[];
  por_campana: CohorteCampana[];
  clientes_nuevos: number;
  clientes_atribuidos: number;
  primera_compra_desde: string | null;
};

function pct(m: Metricas, dias: number): string {
  const v = m.recompra.find((r) => r.dias === dias);
  return v?.pct == null ? '—' : `${v.pct}%`;
}

function Celda({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-600 dark:text-zinc-400">{etiqueta}</dt>
      <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{valor}</dd>
    </div>
  );
}

function FilaCohorte({ titulo, m, extra }: { titulo: string; m: Metricas; extra?: [string, string][] }) {
  return (
    <li className="p-4">
      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{titulo}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
        <Celda etiqueta="Clientes" valor={String(m.clientes)} />
        <Celda etiqueta="Vuelven a 30 días" valor={pct(m, 30)} />
        <Celda etiqueta="Vuelven a 60 días" valor={pct(m, 60)} />
        <Celda etiqueta="Vuelven a 90 días" valor={pct(m, 90)} />
        <Celda etiqueta="Días a la 2.ª compra" valor={m.dias_a_segunda === null ? '—' : String(m.dias_a_segunda)} />
        <Celda etiqueta="Pedidos por cliente" valor={m.pedidos_por_cliente === null ? '—' : String(m.pedidos_por_cliente)} />
        <Celda etiqueta="Han pagado" valor={formatPrecio(m.valor)} />
        {(extra ?? []).map(([e, v]) => (
          <Celda key={e} etiqueta={e} valor={v} />
        ))}
      </dl>
    </li>
  );
}

const LISTA =
  'mt-2 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950';

export default function CohortesRecompra({ desde }: { desde: string }) {
  const [datos, setDatos] = useState<Cohortes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const id = setTimeout(() => {
      void (async () => {
        try {
          const res = await adminFetch(`/admin/anuncios/cohortes?desde=${desde}`);
          if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudieron cargar las cohortes.'));
          const cuerpo = (await res.json()) as Cohortes;
          if (vigente) {
            setDatos(cuerpo);
            setError(null);
          }
        } catch (err) {
          if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar las cohortes.');
        }
      })();
    }, 0);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [desde]);

  return (
    <section aria-label="Cohortes y recompra" className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cohortes y recompra</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {datos && (
        <>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Un porcentaje de recompra solo cuenta a los clientes que ya cumplieron esos días desde su
            primera compra. Los pedidos de WooCommerce no están en la plataforma: la «primera compra»
            es la primera desde {datos.primera_compra_desde ?? 'el inicio'}.
          </p>

          <h3 className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Por campaña</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {datos.clientes_atribuidos} de {datos.clientes_nuevos} clientes nuevos se pudieron ligar a una
            campaña por su primer pedido.
          </p>
          {datos.por_campana.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Todavía no hay clientes nuevos ligados a una campaña en este rango.
            </p>
          ) : (
            <ul className={LISTA}>
              {datos.por_campana.map((c) => (
                <FilaCohorte
                  key={c.campana_id}
                  titulo={c.nombre}
                  m={c}
                  extra={[
                    ['Gasto', formatPrecio(c.gasto)],
                    ['Costo por cliente nuevo', c.costo_por_cliente_nuevo === null ? '—' : formatPrecio(c.costo_por_cliente_nuevo)],
                    ['Pagado ÷ gasto', c.valor_sobre_gasto === null ? '—' : `${c.valor_sobre_gasto}x`],
                  ]}
                />
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Por mes de la primera compra (todos los clientes)
          </h3>
          <ul className={LISTA}>
            {datos.por_mes.map((m) => (
              <FilaCohorte key={m.mes} titulo={m.mes} m={m} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
