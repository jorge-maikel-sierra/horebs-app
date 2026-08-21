'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio, formatCantidad, type UnidadMedida } from '@/lib/formato';
import InventarioTabs from '@/components/InventarioTabs';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type InsumoAlerta = {
  id: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  stock_actual_g: number;
  stock_minimo_g: number;
};

type Reporte = {
  valorizacionTotal: number;
  insumosStockNegativo: InsumoAlerta[];
  insumosStockBajo: InsumoAlerta[];
  gastoComprasMesActual: number;
  gastoComprasMesAnterior: number;
  recetasSinCostear: number;
};

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-500 uppercase dark:text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{valor}</p>
      {nota && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{nota}</p>}
    </div>
  );
}

export default function InventarioReportesPage() {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/inventario/reportes')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el reporte.');
        setReporte(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido.'))
      .finally(() => setCargando(false));
  }, []);

  const variacionGasto =
    reporte && reporte.gastoComprasMesAnterior > 0
      ? ((reporte.gastoComprasMesActual - reporte.gastoComprasMesAnterior) /
          reporte.gastoComprasMesAnterior) *
        100
      : null;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Costo, valorización y alertas del inventario.
      </p>
      <InventarioTabs />

      {cargando && <CargandoSkeleton />}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {reporte && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta
              titulo="Valorización del inventario"
              valor={formatPrecio(reporte.valorizacionTotal)}
              nota="Stock actual × costo unitario"
            />
            <Tarjeta
              titulo="Gasto en compras — este mes"
              valor={formatPrecio(reporte.gastoComprasMesActual)}
              nota={
                variacionGasto === null
                  ? undefined
                  : `${variacionGasto >= 0 ? '+' : ''}${variacionGasto.toLocaleString('es-CO', { maximumFractionDigits: 0 })}% vs. mes anterior`
              }
            />
            <Tarjeta
              titulo="Insumos con stock negativo"
              valor={String(reporte.insumosStockNegativo.length)}
              nota={reporte.insumosStockNegativo.length > 0 ? 'Necesitan un ajuste manual' : undefined}
            />
            <Tarjeta
              titulo="Insumos con stock bajo"
              valor={String(reporte.insumosStockBajo.length)}
              nota={reporte.recetasSinCostear > 0 ? `${reporte.recetasSinCostear} recetas sin costear` : undefined}
            />
          </div>

          {reporte.insumosStockNegativo.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
                ⚠️ Stock negativo — corregir con un ajuste
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {reporte.insumosStockNegativo.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span className="text-zinc-900 dark:text-zinc-50">{i.nombre}</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {formatCantidad(i.stock_actual_g, i.unidad_medida)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/inventario" className="mt-2 inline-block text-xs text-brand-orange underline">
                Ir a Insumos para ajustar →
              </Link>
            </div>
          )}

          {reporte.insumosStockBajo.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-500">
                Stock bajo el mínimo
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {reporte.insumosStockBajo.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 border-b border-zinc-100 py-1 dark:border-zinc-900">
                    <span className="text-zinc-900 dark:text-zinc-50">{i.nombre}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {formatCantidad(i.stock_actual_g, i.unidad_medida)} / mínimo{' '}
                      {formatCantidad(i.stock_minimo_g, i.unidad_medida)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
