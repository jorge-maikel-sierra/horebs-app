'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatCantidad, type UnidadMedida } from '@/lib/formato';
import InventarioTabs from '@/components/InventarioTabs';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Movimiento = {
  id: string;
  insumo_id: string;
  insumo_nombre: string;
  unidad_medida: UnidadMedida;
  tipo: 'compra' | 'venta' | 'ajuste' | 'reversion' | 'merma';
  cantidad_g: number;
  referencia_tipo: string | null;
  motivo: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  compra: 'Compra',
  venta: 'Venta',
  ajuste: 'Ajuste',
  reversion: 'Reversión',
  merma: 'Merma',
};

const TIPO_COLOR: Record<string, string> = {
  compra: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
  venta: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  ajuste: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
  reversion: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  merma: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
};

function formatFechaHora(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

export default function InventarioMovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    setCargando(true);
    const query = filtroTipo ? `?tipo=${filtroTipo}` : '';
    adminFetch(`/inventario/movimientos${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el historial.');
        setMovimientos(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido.'))
      .finally(() => setCargando(false));
  }, [filtroTipo]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Historial de entradas y salidas de stock.
      </p>
      <InventarioTabs />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Tipo:</label>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Todos</option>
          {Object.entries(TIPO_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {cargando && <CargandoSkeleton />}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!cargando && !error && movimientos.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay movimientos registrados todavía.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Insumo</th>
              <th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">Cantidad</th>
              <th className="py-2 pr-2">Motivo / referencia</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-2 text-zinc-500 dark:text-zinc-400">
                  {formatFechaHora(m.created_at)}
                </td>
                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {m.insumo_nombre}
                </td>
                <td className="py-2 pr-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[m.tipo] ?? ''}`}
                  >
                    {TIPO_LABEL[m.tipo] ?? m.tipo}
                  </span>
                </td>
                <td
                  className={`py-2 pr-2 tabular-nums font-semibold ${
                    m.cantidad_g >= 0
                      ? 'text-green-700 dark:text-green-500'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {m.cantidad_g >= 0 ? '+' : ''}
                  {formatCantidad(m.cantidad_g, m.unidad_medida)}
                </td>
                <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                  {m.motivo ?? (m.referencia_tipo === 'pedido' ? 'Pedido' : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
