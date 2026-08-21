'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import InventarioTabs from '@/components/InventarioTabs';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Insumo = { id: string; nombre: string };
type Subreceta = {
  id: string;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number;
  costo_calculado: number;
  componentes: { insumo_id: string; insumo_nombre: string; cantidad_necesaria_g: number }[];
};
type Receta = {
  id: string;
  variante_id: string | null;
  variante_nombre: string | null;
  producto_nombre: string | null;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number | null;
  activa: boolean;
  costo_calculado: number;
  componentes: {
    tipo_componente: 'insumo' | 'subreceta';
    insumo_id: string | null;
    insumo_nombre: string | null;
    subreceta_id: string | null;
    subreceta_nombre: string | null;
    cantidad_necesaria_g: number;
  }[];
};
type Variante = { id: string; nombre: string };
type Producto = { id: string; nombre: string; variantes: Variante[] };

type SubComponenteForm = { insumo_id: string; cantidad_necesaria_g: string };
type RecComponenteForm = {
  tipo_componente: 'insumo' | 'subreceta';
  insumo_id: string;
  subreceta_id: string;
  cantidad_necesaria_g: string;
};

function costo(n: number) {
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;
}

export default function InventarioRecetasPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [subrecetas, setSubrecetas] = useState<Subreceta[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [mostrarFormSub, setMostrarFormSub] = useState(false);
  const [editandoSubId, setEditandoSubId] = useState<string | null>(null);
  const [nombreSub, setNombreSub] = useState('');
  const [rendimientoSub, setRendimientoSub] = useState('');
  const [compSub, setCompSub] = useState<SubComponenteForm[]>([{ insumo_id: '', cantidad_necesaria_g: '' }]);
  const [errorSub, setErrorSub] = useState<string | null>(null);
  const [guardandoSub, setGuardandoSub] = useState(false);

  const [mostrarFormReceta, setMostrarFormReceta] = useState(false);
  const [editandoRecetaId, setEditandoRecetaId] = useState<string | null>(null);
  const [nombreReceta, setNombreReceta] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const [rendimientoReceta, setRendimientoReceta] = useState('');
  const [compReceta, setCompReceta] = useState<RecComponenteForm[]>([
    { tipo_componente: 'insumo', insumo_id: '', subreceta_id: '', cantidad_necesaria_g: '' },
  ]);
  const [errorReceta, setErrorReceta] = useState<string | null>(null);
  const [guardandoReceta, setGuardandoReceta] = useState(false);

  function cargarTodo() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    Promise.all([
      adminFetch('/inventario/insumos').then((r) => r.json()),
      adminFetch('/inventario/subrecetas').then((r) => r.json()),
      adminFetch('/inventario/recetas').then((r) => r.json()),
      fetch(`${apiUrl}/catalogo/productos`).then((r) => r.json()),
    ])
      .then(([i, s, r, p]) => {
        setInsumos(i);
        setSubrecetas(s);
        setRecetas(r);
        setProductos(p);
      })
      .finally(() => setCargando(false));
  }

  useEffect(cargarTodo, []);

  function empezarEdicionSub(s: Subreceta) {
    setEditandoSubId(s.id);
    setNombreSub(s.nombre);
    setRendimientoSub(String(s.rendimiento_g));
    setCompSub(
      s.componentes.map((c) => ({
        insumo_id: c.insumo_id,
        cantidad_necesaria_g: String(c.cantidad_necesaria_g),
      })),
    );
    setErrorSub(null);
    setMostrarFormSub(true);
  }

  function cancelarFormSub() {
    setMostrarFormSub(false);
    setEditandoSubId(null);
    setNombreSub('');
    setRendimientoSub('');
    setCompSub([{ insumo_id: '', cantidad_necesaria_g: '' }]);
    setErrorSub(null);
  }

  async function guardarSubreceta() {
    setErrorSub(null);
    const componentes = compSub.filter((c) => c.insumo_id && c.cantidad_necesaria_g);
    if (!nombreSub.trim() || !rendimientoSub || componentes.length === 0) {
      setErrorSub('Nombre, rendimiento y al menos un insumo son obligatorios.');
      return;
    }
    setGuardandoSub(true);
    try {
      const res = await adminFetch(
        editandoSubId ? `/inventario/subrecetas/${editandoSubId}` : '/inventario/subrecetas',
        {
          method: editandoSubId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre: nombreSub,
            rendimiento_g: Number(rendimientoSub),
            componentes: componentes.map((c) => ({
              insumo_id: c.insumo_id,
              cantidad_necesaria_g: Number(c.cantidad_necesaria_g),
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar la subreceta.');
      }
      cancelarFormSub();
      cargarTodo();
    } catch (err) {
      setErrorSub(err instanceof Error ? err.message : 'No se pudo guardar la subreceta.');
    } finally {
      setGuardandoSub(false);
    }
  }

  function empezarEdicionReceta(r: Receta) {
    setEditandoRecetaId(r.id);
    setNombreReceta(r.nombre);
    setVarianteId(r.variante_id ?? '');
    setRendimientoReceta(r.rendimiento_g ? String(r.rendimiento_g) : '');
    setCompReceta(
      r.componentes.map((c) => ({
        tipo_componente: c.tipo_componente,
        insumo_id: c.insumo_id ?? '',
        subreceta_id: c.subreceta_id ?? '',
        cantidad_necesaria_g: String(c.cantidad_necesaria_g),
      })),
    );
    setErrorReceta(null);
    setMostrarFormReceta(true);
  }

  function cancelarFormReceta() {
    setMostrarFormReceta(false);
    setEditandoRecetaId(null);
    setNombreReceta('');
    setVarianteId('');
    setRendimientoReceta('');
    setCompReceta([{ tipo_componente: 'insumo', insumo_id: '', subreceta_id: '', cantidad_necesaria_g: '' }]);
    setErrorReceta(null);
  }

  async function guardarReceta() {
    setErrorReceta(null);
    const componentes = compReceta.filter(
      (c) => c.cantidad_necesaria_g && (c.tipo_componente === 'insumo' ? c.insumo_id : c.subreceta_id),
    );
    if (!nombreReceta.trim() || componentes.length === 0) {
      setErrorReceta('Nombre y al menos un componente son obligatorios.');
      return;
    }
    setGuardandoReceta(true);
    try {
      const res = await adminFetch(
        editandoRecetaId ? `/inventario/recetas/${editandoRecetaId}` : '/inventario/recetas',
        {
          method: editandoRecetaId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre: nombreReceta,
            variante_id: varianteId || undefined,
            rendimiento_g: rendimientoReceta ? Number(rendimientoReceta) : undefined,
            componentes: componentes.map((c) => ({
              tipo_componente: c.tipo_componente,
              insumo_id: c.tipo_componente === 'insumo' ? c.insumo_id : undefined,
              subreceta_id: c.tipo_componente === 'subreceta' ? c.subreceta_id : undefined,
              cantidad_necesaria_g: Number(c.cantidad_necesaria_g),
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar la receta.');
      }
      cancelarFormReceta();
      cargarTodo();
    } catch (err) {
      setErrorReceta(err instanceof Error ? err.message : 'No se pudo guardar la receta.');
    } finally {
      setGuardandoReceta(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Materia prima, compras y recetas.
      </p>
      <InventarioTabs />

      {cargando && <CargandoSkeleton />}

      {!cargando && (
        <>
          {/* Subrecetas */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Subrecetas</h2>
              <button
                type="button"
                onClick={() => (mostrarFormSub ? cancelarFormSub() : setMostrarFormSub(true))}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
              >
                {mostrarFormSub ? 'Cancelar' : '+ Nueva subreceta'}
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Preparaciones intermedias (masa, salsa) que se reutilizan en varias recetas.
            </p>

            {mostrarFormSub && (
              <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={nombreSub}
                    onChange={(e) => setNombreSub(e.target.value)}
                    placeholder="Nombre (ej: Masa de Pizza Mediana)"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    type="number"
                    min={0}
                    value={rendimientoSub}
                    onChange={(e) => setRendimientoSub(e.target.value)}
                    placeholder="Rendimiento del lote (g)"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="space-y-2">
                  {compSub.map((c, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                      <select
                        value={c.insumo_id}
                        onChange={(e) =>
                          setCompSub((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, insumo_id: e.target.value } : x)),
                          )
                        }
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">Insumo…</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={c.cantidad_necesaria_g}
                        onChange={(e) =>
                          setCompSub((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, cantidad_necesaria_g: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Gramos"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => setCompSub((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-md border border-zinc-300 px-2 text-xs text-red-600 dark:border-zinc-700 dark:text-red-400"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCompSub((prev) => [...prev, { insumo_id: '', cantidad_necesaria_g: '' }])}
                    className="text-xs text-brand-orange underline"
                  >
                    + Agregar insumo
                  </button>
                </div>
                {errorSub && <p className="text-xs text-red-600 dark:text-red-400">{errorSub}</p>}
                <button
                  type="button"
                  disabled={guardandoSub}
                  onClick={guardarSubreceta}
                  className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {guardandoSub ? 'Guardando…' : editandoSubId ? 'Guardar cambios' : 'Crear subreceta'}
                </button>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {subrecetas.map((s) => (
                <li key={s.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{s.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Rinde {s.rendimiento_g}g · costo {costo(s.costo_calculado)}/lote
                      </span>
                      <button
                        type="button"
                        onClick={() => empezarEdicionSub(s)}
                        className="text-xs text-brand-orange underline"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {s.componentes.map((c) => `${c.cantidad_necesaria_g}g ${c.insumo_nombre}`).join(' · ')}
                  </p>
                </li>
              ))}
              {subrecetas.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin subrecetas todavía.</p>
              )}
            </ul>
          </section>

          {/* Recetas */}
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recetas</h2>
              <button
                type="button"
                onClick={() => (mostrarFormReceta ? cancelarFormReceta() : setMostrarFormReceta(true))}
                className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                {mostrarFormReceta ? 'Cancelar' : '+ Nueva receta'}
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Ligadas a un producto del catálogo — al venderse, se descuenta el stock automáticamente.
            </p>

            {mostrarFormReceta && (
              <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={nombreReceta}
                    onChange={(e) => setNombreReceta(e.target.value)}
                    placeholder="Nombre de la receta"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <select
                    value={varianteId}
                    onChange={(e) => setVarianteId(e.target.value)}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Sin ligar a producto todavía</option>
                    {productos.map((p) => (
                      <optgroup key={p.id} label={p.nombre}>
                        {p.variantes.map((v) => (
                          <option key={v.id} value={v.id}>
                            {p.nombre} — {v.nombre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={rendimientoReceta}
                    onChange={(e) => setRendimientoReceta(e.target.value)}
                    placeholder="Peso total (g, opcional)"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>

                <div className="space-y-2">
                  {compReceta.map((c, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[auto_2fr_1fr_auto]">
                      <select
                        value={c.tipo_componente}
                        onChange={(e) =>
                          setCompReceta((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    tipo_componente: e.target.value as 'insumo' | 'subreceta',
                                    insumo_id: '',
                                    subreceta_id: '',
                                  }
                                : x,
                            ),
                          )
                        }
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="insumo">Insumo</option>
                        <option value="subreceta">Subreceta</option>
                      </select>
                      {c.tipo_componente === 'insumo' ? (
                        <select
                          value={c.insumo_id}
                          onChange={(e) =>
                            setCompReceta((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, insumo_id: e.target.value } : x)),
                            )
                          }
                          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">Insumo…</option>
                          {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={c.subreceta_id}
                          onChange={(e) =>
                            setCompReceta((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, subreceta_id: e.target.value } : x)),
                            )
                          }
                          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">Subreceta…</option>
                          {subrecetas.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="number"
                        min={0}
                        value={c.cantidad_necesaria_g}
                        onChange={(e) =>
                          setCompReceta((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, cantidad_necesaria_g: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Gramos"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => setCompReceta((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-md border border-zinc-300 px-2 text-xs text-red-600 dark:border-zinc-700 dark:text-red-400"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setCompReceta((prev) => [
                        ...prev,
                        { tipo_componente: 'insumo', insumo_id: '', subreceta_id: '', cantidad_necesaria_g: '' },
                      ])
                    }
                    className="text-xs text-brand-orange underline"
                  >
                    + Agregar componente
                  </button>
                </div>

                {errorReceta && <p className="text-xs text-red-600 dark:text-red-400">{errorReceta}</p>}
                <button
                  type="button"
                  disabled={guardandoReceta}
                  onClick={guardarReceta}
                  className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {guardandoReceta ? 'Guardando…' : editandoRecetaId ? 'Guardar cambios' : 'Crear receta'}
                </button>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {recetas.map((r) => (
                <li key={r.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{r.nombre}</span>
                      {r.producto_nombre && (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          → {r.producto_nombre} ({r.variante_nombre})
                        </span>
                      )}
                      {!r.variante_id && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          Sin ligar a producto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Costo {costo(r.costo_calculado)}
                      </span>
                      <button
                        type="button"
                        onClick={() => empezarEdicionReceta(r)}
                        className="text-xs text-brand-orange underline"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {r.componentes
                      .map(
                        (c) =>
                          `${c.cantidad_necesaria_g}g ${c.tipo_componente === 'insumo' ? c.insumo_nombre : c.subreceta_nombre}`,
                      )
                      .join(' · ')}
                  </p>
                </li>
              ))}
              {recetas.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin recetas todavía.</p>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
