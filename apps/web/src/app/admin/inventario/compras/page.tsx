'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio, formatFecha } from '@/lib/formato';
import InventarioTabs from '@/components/InventarioTabs';

type Insumo = { id: string; nombre: string };

type DetalleCompra = {
  id: string;
  insumo_id: string | null;
  insumo_nombre: string | null;
  producto_comprado: string;
  cantidad: number;
  unidad_medida_compra: 'kg' | 'g';
  valor_unitario: number;
  total_linea: number;
  estado_procesado: 'pendiente' | 'procesado' | 'excluido';
  fecha_procesado: string | null;
};

type Compra = {
  id: string;
  numero_factura: string | null;
  proveedor: string;
  fecha: string;
  subtotal: number;
  otros_cargos: number;
  metodo_pago: string;
  categoria: string | null;
  created_at: string;
  detalle: DetalleCompra[];
};

type LineaForm = {
  insumo_id: string;
  producto_comprado: string;
  cantidad: string;
  unidad_medida_compra: 'kg' | 'g';
  valor_unitario: string;
};

const LINEA_VACIA: LineaForm = {
  insumo_id: '',
  producto_comprado: '',
  cantidad: '',
  unidad_medida_compra: 'kg',
  valor_unitario: '',
};

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'] as const;

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  procesado: 'Procesado',
  excluido: 'Excluido',
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  procesado: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
  excluido: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500',
};

export default function InventarioComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [proveedor, setProveedor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [otrosCargos, setOtrosCargos] = useState('0');
  const [metodoPago, setMetodoPago] = useState<(typeof METODOS_PAGO)[number]>('efectivo');
  const [categoria, setCategoria] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([{ ...LINEA_VACIA }]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch('/inventario/compras').then((r) => r.json()),
      adminFetch('/inventario/insumos').then((r) => r.json()),
    ])
      .then(([c, i]) => {
        setCompras(c);
        setInsumos(i);
      })
      .catch(() => setError('No se pudieron cargar las compras.'))
      .finally(() => setCargando(false));
  }, []);

  function actualizarLinea(idx: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  const subtotalCalculado = lineas.reduce((acc, l) => {
    const cantidad = Number(l.cantidad) || 0;
    const valor = Number(l.valor_unitario) || 0;
    return acc + cantidad * valor;
  }, 0);

  async function crearCompra() {
    setErrorForm(null);
    if (!proveedor.trim()) {
      setErrorForm('Falta el proveedor.');
      return;
    }
    const detalle = lineas.filter((l) => l.producto_comprado.trim());
    if (detalle.length === 0) {
      setErrorForm('Agregá al menos una línea.');
      return;
    }
    setGuardando(true);
    try {
      const res = await adminFetch('/inventario/compras', {
        method: 'POST',
        body: JSON.stringify({
          proveedor,
          numero_factura: numeroFactura || undefined,
          fecha,
          subtotal: subtotalCalculado,
          otros_cargos: Number(otrosCargos) || 0,
          metodo_pago: metodoPago,
          categoria: categoria || undefined,
          detalle: detalle.map((l) => ({
            insumo_id: l.insumo_id || undefined,
            producto_comprado: l.producto_comprado,
            cantidad: Number(l.cantidad),
            unidad_medida_compra: l.unidad_medida_compra,
            valor_unitario: Number(l.valor_unitario),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar la compra.');
      }
      const nueva: Compra = await res.json();
      setCompras((prev) => [nueva, ...prev]);
      setMostrarForm(false);
      setProveedor('');
      setNumeroFactura('');
      setOtrosCargos('0');
      setCategoria('');
      setLineas([{ ...LINEA_VACIA }]);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo registrar la compra.');
    } finally {
      setGuardando(false);
    }
  }

  async function vincularInsumo(compraId: string, detalleId: string, insumoId: string) {
    if (!insumoId) return;
    const res = await adminFetch(`/inventario/compras/detalle/${detalleId}/vincular`, {
      method: 'PATCH',
      body: JSON.stringify({ insumo_id: insumoId }),
    });
    if (!res.ok) return;
    const insumo = insumos.find((i) => i.id === insumoId);
    setCompras((prev) =>
      prev.map((c) =>
        c.id === compraId
          ? {
              ...c,
              detalle: c.detalle.map((d) =>
                d.id === detalleId ? { ...d, insumo_id: insumoId, insumo_nombre: insumo?.nombre ?? null } : d,
              ),
            }
          : c,
      ),
    );
  }

  async function procesarLinea(compraId: string, detalleId: string) {
    setProcesandoId(detalleId);
    try {
      const res = await adminFetch(`/inventario/compras/detalle/${detalleId}/procesar`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo procesar la línea.');
      }
      setCompras((prev) =>
        prev.map((c) =>
          c.id === compraId
            ? {
                ...c,
                detalle: c.detalle.map((d) =>
                  d.id === detalleId
                    ? { ...d, estado_procesado: 'procesado', fecha_procesado: new Date().toISOString() }
                    : d,
                ),
              }
            : c,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo procesar la línea.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function excluirLinea(compraId: string, detalleId: string) {
    const res = await adminFetch(`/inventario/compras/detalle/${detalleId}/excluir`, {
      method: 'PATCH',
    });
    if (!res.ok) return;
    setCompras((prev) =>
      prev.map((c) =>
        c.id === compraId
          ? {
              ...c,
              detalle: c.detalle.map((d) => (d.id === detalleId ? { ...d, estado_procesado: 'excluido' } : d)),
            }
          : c,
      ),
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Materia prima, compras y recetas.
      </p>
      <InventarioTabs />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-md bg-brand-orange px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {mostrarForm ? 'Cancelar' : '+ Registrar factura'}
        </button>
      </div>

      {mostrarForm && (
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Proveedor"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              placeholder="N° factura (opcional)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Categoría (ej: Harinas y Granos)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="number"
              min={0}
              value={otrosCargos}
              onChange={(e) => setOtrosCargos(e.target.value)}
              placeholder="Otros cargos (IVA, flete)"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as (typeof METODOS_PAGO)[number])}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm capitalize dark:border-zinc-700 dark:bg-zinc-900"
            >
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Líneas</p>
            <div className="mt-2 space-y-2">
              {lineas.map((l, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto]">
                  <input
                    value={l.producto_comprado}
                    onChange={(e) => actualizarLinea(idx, { producto_comprado: e.target.value })}
                    placeholder="Descripción (de la factura)"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={l.cantidad}
                    onChange={(e) => actualizarLinea(idx, { cantidad: e.target.value })}
                    placeholder="Cantidad"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <select
                    value={l.unidad_medida_compra}
                    onChange={(e) =>
                      actualizarLinea(idx, { unidad_medida_compra: e.target.value as 'kg' | 'g' })
                    }
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={l.valor_unitario}
                    onChange={(e) => actualizarLinea(idx, { valor_unitario: e.target.value })}
                    placeholder="Valor unitario"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <select
                    value={l.insumo_id}
                    onChange={(e) => actualizarLinea(idx, { insumo_id: e.target.value })}
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Sin insumo (vincular después)</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-md border border-zinc-300 px-2 text-xs text-red-600 dark:border-zinc-700"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
              className="mt-2 text-xs text-brand-orange underline"
            >
              + Agregar línea
            </button>
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Subtotal: <span className="font-semibold">{formatPrecio(subtotalCalculado)}</span>
          </p>

          {errorForm && <p className="text-xs text-red-600">{errorForm}</p>}
          <button
            type="button"
            disabled={guardando}
            onClick={crearCompra}
            className="rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Registrar factura'}
          </button>
        </div>
      )}

      {cargando && <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {!cargando && !error && compras.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no hay compras registradas.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {compras.map((c) => (
          <li key={c.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{c.proveedor}</span>
                {c.numero_factura && (
                  <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Fact. {c.numero_factura}
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatFecha(c.fecha)}</span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {formatPrecio(c.subtotal)}
              {c.otros_cargos > 0 && ` + ${formatPrecio(c.otros_cargos)} otros cargos`} ·{' '}
              <span className="capitalize">{c.metodo_pago}</span>
              {c.categoria && ` · ${c.categoria}`}
            </p>

            <ul className="mt-3 space-y-1.5">
              {c.detalle.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-100 px-2 py-1.5 text-sm dark:border-zinc-900"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{d.producto_comprado}</span>
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                      {d.cantidad} {d.unidad_medida_compra} × {formatPrecio(d.valor_unitario)} ={' '}
                      {formatPrecio(d.total_linea)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[d.estado_procesado]}`}
                    >
                      {ESTADO_LABEL[d.estado_procesado]}
                    </span>
                    {d.estado_procesado === 'pendiente' && (
                      <>
                        {d.insumo_id ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {d.insumo_nombre}
                          </span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={(e) => vincularInsumo(c.id, d.id, e.target.value)}
                            className="rounded-md border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="" disabled>
                              Vincular insumo…
                            </option>
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          disabled={!d.insumo_id || procesandoId === d.id}
                          onClick={() => procesarLinea(c.id, d.id)}
                          className="rounded-md bg-brand-orange px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                        >
                          {procesandoId === d.id ? 'Procesando…' : 'Procesar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirLinea(c.id, d.id)}
                          className="text-xs text-zinc-500 underline dark:text-zinc-400"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
