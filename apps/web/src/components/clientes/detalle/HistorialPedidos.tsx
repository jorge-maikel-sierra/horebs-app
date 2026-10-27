'use client';

import { useState, type CSSProperties } from 'react';
import { FOCO, TARJETA } from '@/components/formulario/estilos';
import { CANAL_LABEL, MODALIDAD_LABEL } from '@/lib/pedidos-busqueda';
import { formatPrecio } from '@/lib/formato';
import {
  productosFavoritos,
  valorFrecuente,
  type PedidoCliente,
} from '@/lib/clientes-directorio';

const POR_LOTE = 8;

const FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

const ESTADO: Record<string, { texto: string; clase: string }> = {
  entregado: {
    texto: 'Entregado',
    clase:
      'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
  },
  cancelado: {
    texto: 'Cancelado',
    clase: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  },
  pendiente: {
    texto: 'Pendiente',
    clase:
      'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  },
  confirmado: {
    texto: 'Confirmado',
    clase: 'bg-blue-100 text-brand-navy dark:bg-blue-400/15 dark:text-blue-300',
  },
  en_preparacion: {
    texto: 'En preparación',
    clase: 'bg-brand-orange/15 text-accent-ink',
  },
  en_camino: {
    texto: 'En camino',
    clase: 'bg-brand-orange/15 text-accent-ink',
  },
};

const ETIQUETA_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

function fechaCorta(iso: string) {
  return FECHA.format(new Date(iso)).replace(/\./g, '');
}

/** Lo que más pide, cómo paga y cómo recibe: se calcula del propio historial. */
function Preferencias({ pedidos }: { pedidos: PedidoCliente[] }) {
  const favoritos = productosFavoritos(pedidos);
  const pago = valorFrecuente(pedidos, 'metodo_pago');
  const modalidad = valorFrecuente(pedidos, 'modalidad');
  if (favoritos.length === 0) return null;

  return (
    <section className={TARJETA} aria-label="Preferencias del cliente">
      <h2 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        Lo que más pide
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {favoritos.map((f) => (
          <li
            key={f.nombre}
            className="inline-flex items-center gap-2 rounded-full bg-brand-orange/10 py-1 pr-1 pl-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
          >
            {f.nombre}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-accent-ink dark:bg-zinc-900">
              ×{f.cantidad}
            </span>
          </li>
        ))}
      </ul>
      {(pago || modalidad) && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {pago && (
            <>
              Suele pagar con{' '}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                {(ETIQUETA_PAGO[pago.valor] ?? pago.valor).toLowerCase()}
              </strong>{' '}
              ({pago.pct} %)
            </>
          )}
          {pago && modalidad && ' · '}
          {modalidad && (
            <>
              pide{' '}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                {(
                  MODALIDAD_LABEL[modalidad.valor] ?? modalidad.valor
                ).toLowerCase()}
              </strong>{' '}
              ({modalidad.pct} %)
            </>
          )}
          .
        </p>
      )}
    </section>
  );
}

export default function HistorialPedidos({
  pedidos,
  totalPedidos,
}: {
  /** null = no se pudo cargar. */
  pedidos: PedidoCliente[] | null;
  totalPedidos: number;
}) {
  const [visibles, setVisibles] = useState(POR_LOTE);

  if (pedidos === null) {
    return (
      <section className={TARJETA}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
          Pedidos
        </h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          No se pudo cargar el historial de pedidos.
        </p>
      </section>
    );
  }

  const lista = pedidos.slice(0, visibles);

  return (
    <div className="space-y-4">
      <Preferencias pedidos={pedidos} />

      <section className={TARJETA} aria-labelledby="titulo-historial-pedidos">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="titulo-historial-pedidos"
            className="font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Pedidos
          </h2>
          <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {totalPedidos} en total
          </span>
        </div>

        {pedidos.length === 0 ? (
          <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-4 text-sm text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
            Este cliente todavía no tiene pedidos.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {lista.map((p, i) => {
              const estado = ESTADO[p.estado] ?? {
                texto: p.estado.replace(/_/g, ' '),
                clase:
                  'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
              };
              return (
                <li
                  key={p.id}
                  style={{ '--i': Math.min(i, 8) } as CSSProperties}
                  className="resultado-item rounded-2xl border border-zinc-200 p-3.5 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 first-letter:uppercase dark:text-zinc-50">
                        {fechaCorta(p.created_at)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        #{p.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums text-accent-ink">
                        {formatPrecio(p.total)}
                      </p>
                      {p.costo_domicilio > 0 && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          incl. {formatPrecio(p.costo_domicilio)} domicilio
                        </p>
                      )}
                    </div>
                  </div>

                  {p.items.length > 0 && (
                    <ul className="mt-2.5 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                      {p.items.map((it, k) => (
                        <li key={`${it.nombre}-${k}`} className="flex gap-2">
                          <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                            {it.cantidad}×
                          </span>
                          <span className="min-w-0 [overflow-wrap:anywhere]">
                            {it.nombre}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${estado.clase}`}
                    >
                      {estado.texto}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold text-white ${
                        p.canal === 'pos'
                          ? 'bg-brand-navy'
                          : p.canal === 'whatsapp'
                            ? 'bg-emerald-700'
                            : 'bg-brand-orange'
                      }`}
                    >
                      {CANAL_LABEL[p.canal] ?? p.canal}
                    </span>
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {MODALIDAD_LABEL[p.modalidad] ?? p.modalidad}
                    </span>
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {ETIQUETA_PAGO[p.metodo_pago] ?? p.metodo_pago}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {pedidos.length > visibles && (
          <button
            type="button"
            onClick={() => setVisibles((v) => v + POR_LOTE)}
            className={`btn-press mt-4 h-11 w-full rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 transition-colors hover:border-accent-ink dark:border-zinc-700 dark:text-zinc-300 ${FOCO}`}
          >
            Ver más pedidos ({pedidos.length - visibles} restantes)
          </button>
        )}
        {pedidos.length < totalPedidos && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Se muestran los {pedidos.length} pedidos más recientes.
          </p>
        )}
      </section>
    </div>
  );
}
