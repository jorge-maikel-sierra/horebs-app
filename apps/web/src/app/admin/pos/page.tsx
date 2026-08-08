'use client';

import { useEffect, useState, type FormEvent } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';

type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

type Producto = { id: string; nombre: string; variantes: Variante[] };

type ItemVenta = {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
  cantidad: number;
};

const COSTO_DOMICILIO_DEFAULT = 5000;

function PosInterno() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [modalidad, setModalidad] = useState<'mostrador' | 'domicilio'>(
    'mostrador',
  );
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [costoDomicilio, setCostoDomicilio] = useState(COSTO_DOMICILIO_DEFAULT);
  const [metodoPago, setMetodoPago] = useState<
    'efectivo' | 'transferencia' | 'tarjeta'
  >('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    fetch(`${apiUrl}/catalogo/productos`)
      .then((r) => r.json())
      .then(setProductos)
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  function agregarItem(producto: Producto, variante: Variante) {
    const precio = variante.precio_oferta ?? variante.precio;
    setItems((prev) => {
      const existente = prev.find((i) => i.varianteId === variante.id);
      if (existente) {
        return prev.map((i) =>
          i.varianteId === variante.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          varianteId: variante.id,
          productoNombre: producto.nombre,
          varianteNombre: variante.nombre,
          precio,
          cantidad: 1,
        },
      ];
    });
  }

  function actualizarCantidad(varianteId: string, cantidad: number) {
    if (cantidad <= 0) {
      setItems((prev) => prev.filter((i) => i.varianteId !== varianteId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.varianteId === varianteId ? { ...i, cantidad } : i)),
    );
  }

  const totalItems = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const total = totalItems + (modalidad === 'domicilio' ? costoDomicilio : 0);

  async function registrarVenta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (items.length === 0) {
      setError('Agregá al menos un producto.');
      return;
    }
    if (modalidad === 'domicilio' && !direccionEntrega.trim()) {
      setError('Falta la dirección de entrega.');
      return;
    }

    setEnviando(true);
    try {
      const res = await adminFetch('/admin/ventas', {
        method: 'POST',
        body: JSON.stringify({
          cliente: { nombre, telefono: telefono || undefined },
          modalidad,
          direccion_entrega:
            modalidad === 'domicilio' ? direccionEntrega : undefined,
          costo_domicilio: modalidad === 'domicilio' ? costoDomicilio : undefined,
          metodo_pago: metodoPago,
          items: items.map((i) => ({
            variante_id: i.varianteId,
            cantidad: i.cantidad,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar la venta.');
      }

      const venta = await res.json();
      setMensaje(`Venta registrada — total ${formatPrecio(venta.total)}.`);
      setItems([]);
      setNombre('');
      setTelefono('');
      setModalidad('mostrador');
      setDireccionEntrega('');
      setCostoDomicilio(COSTO_DOMICILIO_DEFAULT);
      setMetodoPago('efectivo');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo registrar la venta.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Punto de venta
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Productos
          </h2>
          <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto pr-2">
            {productos.map((producto) => (
              <div
                key={producto.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {producto.nombre}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {producto.variantes.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {v.nombre} — {formatPrecio(v.precio_oferta ?? v.precio)}
                      </span>
                      <button
                        type="button"
                        onClick={() => agregarItem(producto, v)}
                        className="shrink-0 rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Agregar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Venta actual
          </h2>

          {items.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Todavía no agregaste productos.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li
                  key={i.varianteId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {i.productoNombre} ({i.varianteNombre})
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        actualizarCantidad(i.varianteId, i.cantidad - 1)
                      }
                      className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                    >
                      −
                    </button>
                    {i.cantidad}
                    <button
                      type="button"
                      onClick={() =>
                        actualizarCantidad(i.varianteId, i.cantidad + 1)
                      }
                      className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                    >
                      +
                    </button>
                    <span className="w-20 text-right font-medium">
                      {formatPrecio(i.precio * i.cantidad)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {modalidad === 'domicilio' && (
              <>
                <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>{formatPrecio(totalItems)}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span>Domicilio</span>
                  <span>{formatPrecio(costoDomicilio)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-brand-orange">{formatPrecio(total)}</span>
            </div>
          </div>

          <form onSubmit={registrarVenta} className="mt-6 space-y-3">
            <div>
              <label className="block text-sm font-medium">
                Nombre del cliente
              </label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Teléfono (opcional)
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <span className="block text-sm font-medium">Modalidad</span>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="modalidad"
                    checked={modalidad === 'mostrador'}
                    onChange={() => setModalidad('mostrador')}
                  />
                  Mostrador
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="modalidad"
                    checked={modalidad === 'domicilio'}
                    onChange={() => setModalidad('domicilio')}
                  />
                  Domicilio
                </label>
              </div>
            </div>

            {modalidad === 'domicilio' && (
              <>
                <div>
                  <label className="block text-sm font-medium">
                    Dirección de entrega
                  </label>
                  <input
                    required
                    value={direccionEntrega}
                    onChange={(e) => setDireccionEntrega(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Costo de domicilio
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step={500}
                    value={costoDomicilio}
                    onChange={(e) => setCostoDomicilio(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </>
            )}

            <div>
              <span className="block text-sm font-medium">Método de pago</span>
              <div className="mt-1 flex flex-wrap gap-4">
                {(['efectivo', 'transferencia', 'tarjeta'] as const).map(
                  (m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2 text-sm capitalize"
                    >
                      <input
                        type="radio"
                        name="metodoPago"
                        checked={metodoPago === m}
                        onChange={() => setMetodoPago(m)}
                      />
                      {m}
                    </label>
                  ),
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {mensaje && <p className="text-sm text-green-600">{mensaje}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-brand-orange py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? 'Registrando…' : 'Registrar venta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PosPage() {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <PosInterno />
    </RequireRol>
  );
}
