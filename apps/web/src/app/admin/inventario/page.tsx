'use client';

import { Fragment, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatCantidad, formatFecha, type UnidadMedida } from '@/lib/formato';
import InventarioTabs from '@/components/InventarioTabs';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Insumo = {
  id: string;
  nombre: string;
  categoria: string;
  unidad_medida: UnidadMedida;
  stock_actual_g: number;
  stock_minimo_g: number;
  costo_unitario_g: number;
  proveedor_principal: string | null;
  fecha_ultima_compra: string | null;
  activo: boolean;
};

const UNIDADES: { valor: UnidadMedida; label: string }[] = [
  { valor: 'g', label: 'Gramos' },
  { valor: 'ml', label: 'Mililitros' },
  { valor: 'unidad', label: 'Unidad' },
];

const FORM_VACIO = {
  nombre: '',
  categoria: '',
  unidad_medida: 'g' as UnidadMedida,
  stock_minimo_g: '',
  proveedor_principal: '',
};

const AJUSTE_VACIO = { tipo: 'ajuste' as 'ajuste' | 'merma', cantidad: '', motivo: '' };

export default function InventarioInsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [stockMinimoEdit, setStockMinimoEdit] = useState('');

  const [ajustandoId, setAjustandoId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState(AJUSTE_VACIO);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null);

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
          unidad_medida: form.unidad_medida,
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
      setForm(FORM_VACIO);
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

  function empezarAjuste(id: string) {
    setAjustandoId(id);
    setAjuste(AJUSTE_VACIO);
    setErrorAjuste(null);
  }

  async function guardarAjuste(id: string) {
    setErrorAjuste(null);
    const cantidad = Number(ajuste.cantidad);
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      setErrorAjuste('La cantidad no puede ser cero.');
      return;
    }
    if (!ajuste.motivo.trim()) {
      setErrorAjuste('Contá el motivo del ajuste.');
      return;
    }
    setGuardandoAjuste(true);
    try {
      const res = await adminFetch(`/inventario/insumos/${id}/ajuste`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: ajuste.tipo,
          cantidad_g: cantidad,
          motivo: ajuste.motivo.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar el ajuste.');
      }
      const actualizado: Insumo = await res.json();
      setInsumos((prev) => prev.map((i) => (i.id === id ? actualizado : i)));
      setAjustandoId(null);
    } catch (err) {
      setErrorAjuste(err instanceof Error ? err.message : 'No se pudo registrar el ajuste.');
    } finally {
      setGuardandoAjuste(false);
    }
  }

  const stockBajoCount = insumos.filter((i) => i.stock_actual_g <= i.stock_minimo_g).length;
  const stockNegativoCount = insumos.filter((i) => i.stock_actual_g < 0).length;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Materia prima, compras y recetas.
      </p>
      <InventarioTabs />

      {stockNegativoCount > 0 && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          ⚠️ {stockNegativoCount} insumo{stockNegativoCount > 1 ? 's' : ''} con stock negativo —
          el sistema descontó más de lo que había cargado. Corregilo con un ajuste manual abajo.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
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
          <div className="grid gap-2 sm:grid-cols-5">
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
            <select
              value={form.unidad_medida}
              onChange={(e) =>
                setForm((f) => ({ ...f, unidad_medida: e.target.value as UnidadMedida }))
              }
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {UNIDADES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={form.stock_minimo_g}
              onChange={(e) => setForm((f) => ({ ...f, stock_minimo_g: e.target.value }))}
              placeholder="Stock mínimo"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={form.proveedor_principal}
              onChange={(e) => setForm((f) => ({ ...f, proveedor_principal: e.target.value }))}
              placeholder="Proveedor (opcional)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {errorForm && <p className="text-xs text-red-600 dark:text-red-400">{errorForm}</p>}
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

      {cargando && <CargandoSkeleton />}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!cargando && !error && insumos.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay insumos {soloStockBajo ? 'con stock bajo' : 'cargados todavía'}.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-2">Insumo</th>
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2">Stock</th>
              <th className="py-2 pr-2">Mínimo</th>
              <th className="py-2 pr-2">Costo</th>
              <th className="py-2 pr-2">Proveedor</th>
              <th className="py-2 pr-2">Última compra</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) => {
              const negativo = i.stock_actual_g < 0;
              const stockBajo = i.stock_actual_g <= i.stock_minimo_g;
              return (
                <Fragment key={i.id}>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-50">
                      {i.nombre}
                    </td>
                    <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">{i.categoria}</td>
                    <td
                      className={`py-2 pr-2 font-semibold tabular-nums ${
                        negativo
                          ? 'text-red-600 dark:text-red-400'
                          : stockBajo
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-zinc-900 dark:text-zinc-50'
                      }`}
                    >
                      {formatCantidad(i.stock_actual_g, i.unidad_medida)}
                      {negativo ? ' ⚠️' : stockBajo ? ' ⚠︎' : ''}
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
                          {formatCantidad(i.stock_minimo_g, i.unidad_medida)}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                      ${i.costo_unitario_g.toLocaleString('es-CO', { maximumFractionDigits: 2 })}/
                      {i.unidad_medida === 'unidad' ? 'u' : i.unidad_medida}
                    </td>
                    <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                      {i.proveedor_principal ?? '—'}
                    </td>
                    <td className="py-2 pr-2 text-zinc-500 dark:text-zinc-400">
                      {i.fecha_ultima_compra ? formatFecha(i.fecha_ultima_compra) : '—'}
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => empezarAjuste(i.id)}
                        className="text-xs text-brand-orange underline"
                      >
                        Ajustar
                      </button>
                    </td>
                  </tr>
                  {ajustandoId === i.id && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-900">
                      <td colSpan={8} className="bg-zinc-50 px-2 py-3 dark:bg-zinc-900/60">
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-zinc-400">Tipo</label>
                            <select
                              value={ajuste.tipo}
                              onChange={(e) =>
                                setAjuste((a) => ({ ...a, tipo: e.target.value as 'ajuste' | 'merma' }))
                              }
                              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <option value="ajuste">Ajuste (conteo físico)</option>
                              <option value="merma">Merma (pérdida/daño)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 dark:text-zinc-400">
                              {ajuste.tipo === 'merma'
                                ? `Cantidad perdida (${i.unidad_medida})`
                                : `Cantidad (+/-, ${i.unidad_medida})`}
                            </label>
                            <input
                              type="number"
                              value={ajuste.cantidad}
                              onChange={(e) => setAjuste((a) => ({ ...a, cantidad: e.target.value }))}
                              placeholder={ajuste.tipo === 'merma' ? '50' : '-50 o 50'}
                              className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </div>
                          <div className="min-w-[220px] flex-1">
                            <label className="block text-xs text-zinc-500 dark:text-zinc-400">Motivo</label>
                            <input
                              value={ajuste.motivo}
                              onChange={(e) => setAjuste((a) => ({ ...a, motivo: e.target.value }))}
                              placeholder={
                                ajuste.tipo === 'merma'
                                  ? 'Ej: se cayó una bolsa en la cocina'
                                  : 'Ej: conteo físico de fin de mes'
                              }
                              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={guardandoAjuste}
                            onClick={() => guardarAjuste(i.id)}
                            className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {guardandoAjuste ? 'Guardando…' : 'Registrar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAjustandoId(null)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
                          >
                            Cancelar
                          </button>
                        </div>
                        {errorAjuste && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorAjuste}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
