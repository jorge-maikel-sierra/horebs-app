'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatGramos, formatFecha } from '@/lib/formato';
import InventarioTabs from '@/components/InventarioTabs';

type Insumo = {
  id: string;
  nombre: string;
  categoria: string;
  stock_actual_g: number;
  stock_minimo_g: number;
  costo_unitario_g: number;
  proveedor_principal: string | null;
  fecha_ultima_compra: string | null;
  activo: boolean;
};

const CATEGORIA_VACIA = { nombre: '', categoria: '', stock_minimo_g: '', proveedor_principal: '' };

export default function InventarioInsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(CATEGORIA_VACIA);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [stockMinimoEdit, setStockMinimoEdit] = useState('');

  function cargar() {
    setCargando(true);
    adminFetch(`/inventario/insumos${soloStockBajo ? '?stockBajo=true' : ''}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los insumos.');
        setInsumos(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido.'))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [soloStockBajo]);

  async function crearInsumo() {
    setErrorForm(null);
    if (!form.nombre.trim() || !form.categoria.trim()) {
      setErrorForm('Nombre y categoría son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const res = await adminFetch('/inventario/insumos', {
        method: 'POST',
        body: JSON.stringify({
          nombre: form.nombre,
          categoria: form.categoria,
          stock_minimo_g: form.stock_minimo_g ? Number(form.stock_minimo_g) : undefined,
          proveedor_principal: form.proveedor_principal || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo crear el insumo.');
      }
      const nuevo: Insumo = await res.json();
      setInsumos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm(CATEGORIA_VACIA);
      setMostrarForm(false);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo crear el insumo.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarStockMinimo(id: string) {
    const valor = Number(stockMinimoEdit);
    if (!Number.isFinite(valor) || valor < 0) return;
    const res = await adminFetch(`/inventario/insumos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock_minimo_g: valor }),
    });
    if (res.ok) {
      const actualizado: Insumo = await res.json();
      setInsumos((prev) => prev.map((i) => (i.id === id ? actualizado : i)));
    }
    setEditandoId(null);
  }

  const stockBajoCount = insumos.filter((i) => i.stock_actual_g <= i.stock_minimo_g).length;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Materia prima, compras y recetas.
      </p>
      <InventarioTabs />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={soloStockBajo}
            onChange={(e) => setSoloStockBajo(e.target.checked)}
          />
          Mostrar solo stock bajo {stockBajoCount > 0 && `(${stockBajoCount})`}
        </label>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-md bg-brand-orange px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo insumo'}
        </button>
      </div>

      {mostrarForm && (
        <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              placeholder="Categoría"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="number"
              min={0}
              value={form.stock_minimo_g}
              onChange={(e) => setForm((f) => ({ ...f, stock_minimo_g: e.target.value }))}
              placeholder="Stock mínimo (g)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={form.proveedor_principal}
              onChange={(e) => setForm((f) => ({ ...f, proveedor_principal: e.target.value }))}
              placeholder="Proveedor (opcional)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {errorForm && <p className="text-xs text-red-600">{errorForm}</p>}
          <button
            type="button"
            disabled={guardando}
            onClick={crearInsumo}
            className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Crear insumo'}
          </button>
        </div>
      )}

      {cargando && <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {!cargando && !error && insumos.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay insumos {soloStockBajo ? 'con stock bajo' : 'cargados todavía'}.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-2">Insumo</th>
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2">Stock</th>
              <th className="py-2 pr-2">Mínimo</th>
              <th className="py-2 pr-2">Costo/g</th>
              <th className="py-2 pr-2">Proveedor</th>
              <th className="py-2 pr-2">Última compra</th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => {
              const stockBajo = i.stock_actual_g <= i.stock_minimo_g;
              return (
                <tr
                  key={i.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {i.nombre}
                  </td>
                  <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">{i.categoria}</td>
                  <td
                    className={`py-2 pr-2 font-semibold tabular-nums ${
                      stockBajo ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-50'
                    }`}
                  >
                    {formatGramos(i.stock_actual_g)}
                    {stockBajo && ' ⚠︎'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {editandoId === i.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={stockMinimoEdit}
                        onChange={(e) => setStockMinimoEdit(e.target.value)}
                        onBlur={() => guardarStockMinimo(i.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className="w-20 rounded-md border border-zinc-300 px-1.5 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoId(i.id);
                          setStockMinimoEdit(String(i.stock_minimo_g));
                        }}
                        className="underline decoration-dotted"
                      >
                        {formatGramos(i.stock_minimo_g)}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    ${i.costo_unitario_g.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                    {i.proveedor_principal ?? '—'}
                  </td>
                  <td className="py-2 pr-2 text-zinc-500 dark:text-zinc-400">
                    {i.fecha_ultima_compra ? formatFecha(i.fecha_ultima_compra) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
