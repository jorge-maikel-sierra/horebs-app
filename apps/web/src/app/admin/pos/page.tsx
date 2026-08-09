'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';

type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

type Producto = {
  id: string;
  nombre: string;
  categoria_id: string;
  variantes: Variante[];
};

type Categoria = { id: string; nombre: string; orden: number };

type ItemVenta = {
  id: string;
  varianteId: string | null;
  nombrePersonalizado: string | null;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
  cantidad: number;
};

type ClienteBusqueda = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
};

type Modalidad = 'local' | 'retiro' | 'domicilio';

const COSTO_DOMICILIO_DEFAULT = 5000;

const MODALIDAD_OPCIONES: { valor: Modalidad; etiqueta: string }[] = [
  { valor: 'local', etiqueta: 'Comer en el local' },
  { valor: 'retiro', etiqueta: 'Para llevar' },
  { valor: 'domicilio', etiqueta: 'Domicilio' },
];

function PosInterno() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<
    string | null
  >(null);
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<
    ClienteBusqueda[]
  >([]);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [precioPersonalizado, setPrecioPersonalizado] = useState('');
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(
    null,
  );
  const [modalidad, setModalidad] = useState<Modalidad>('local');
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
    Promise.all([
      fetch(`${apiUrl}/catalogo/categorias`).then((r) => r.json()),
      fetch(`${apiUrl}/catalogo/productos`).then((r) => r.json()),
    ])
      .then(([cats, prods]) => {
        setCategorias(cats);
        setProductos(prods);
      })
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  useEffect(() => {
    if (!busquedaCliente.trim()) {
      setResultadosCliente([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const res = await adminFetch(
        `/admin/clientes?q=${encodeURIComponent(busquedaCliente)}`,
      );
      if (res.ok) setResultadosCliente(await res.json());
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaCliente]);

  function seleccionarCliente(c: ClienteBusqueda) {
    setNombre(c.nombre);
    setApellido(c.apellido ?? '');
    setTelefono(c.telefono ?? '');
    setCorreo(c.correo ?? '');
    setBusquedaCliente('');
    setResultadosCliente([]);
  }

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
          id: variante.id,
          varianteId: variante.id,
          nombrePersonalizado: null,
          productoNombre: producto.nombre,
          varianteNombre: variante.nombre,
          precio,
          cantidad: 1,
        },
      ];
    });
  }

  function agregarPersonalizado() {
    const nombre = nombrePersonalizado.trim();
    const precio = Number(precioPersonalizado);
    if (!nombre) {
      setError('Escribí el nombre del producto personalizado.');
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setError('El precio del producto personalizado no es válido.');
      return;
    }
    setError(null);
    setItems((prev) => [
      ...prev,
      {
        id: `personalizado-${crypto.randomUUID()}`,
        varianteId: null,
        nombrePersonalizado: nombre,
        productoNombre: nombre,
        varianteNombre: '',
        precio,
        cantidad: 1,
      },
    ]);
    setNombrePersonalizado('');
    setPrecioPersonalizado('');
  }

  function actualizarCantidad(id: string, cantidad: number) {
    if (cantidad <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad } : i)),
    );
  }

  function editarPrecio(id: string, precio: number) {
    if (!Number.isFinite(precio) || precio < 0) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, precio } : i)),
    );
  }

  const totalItems = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const total = totalItems + (modalidad === 'domicilio' ? costoDomicilio : 0);

  const productosDeCategoria = categoriaSeleccionada
    ? productos.filter((p) => p.categoria_id === categoriaSeleccionada)
    : [];

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
          cliente: {
            nombre,
            apellido: apellido || undefined,
            telefono: telefono || undefined,
            correo: correo || undefined,
          },
          modalidad,
          direccion_entrega:
            modalidad === 'domicilio' ? direccionEntrega : undefined,
          costo_domicilio: modalidad === 'domicilio' ? costoDomicilio : undefined,
          metodo_pago: metodoPago,
          items: items.map((i) =>
            i.varianteId
              ? {
                  variante_id: i.varianteId,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio,
                }
              : {
                  nombre_personalizado: i.nombrePersonalizado,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio,
                },
          ),
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
      setApellido('');
      setTelefono('');
      setCorreo('');
      setNombrePersonalizado('');
      setPrecioPersonalizado('');
      setEditandoPrecioId(null);
      setModalidad('local');
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Punto de venta
        </h1>
        <Link
          href="/admin/pedidos"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300"
        >
          Ver pedidos
        </Link>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Productos
          </h2>

          {!categoriaSeleccionada ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  className="rounded-lg border border-zinc-200 p-4 text-center font-semibold text-zinc-900 hover:border-brand-orange dark:border-zinc-800 dark:text-zinc-50"
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCategoriaSeleccionada(null)}
                className="text-sm text-brand-orange underline"
              >
                ← Volver a categorías
              </button>
              <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                {productosDeCategoria.map((producto) => (
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
                            {v.nombre} —{' '}
                            {formatPrecio(v.precio_oferta ?? v.precio)}
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
          )}

          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Producto personalizado
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Para bordes, adicionales o algo que no esté en el catálogo.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={nombrePersonalizado}
                onChange={(e) => setNombrePersonalizado(e.target.value)}
                placeholder="Ej: Borde de queso"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="number"
                min={0}
                step={500}
                value={precioPersonalizado}
                onChange={(e) => setPrecioPersonalizado(e.target.value)}
                placeholder="Precio"
                className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={agregarPersonalizado}
                className="shrink-0 rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Agregar
              </button>
            </div>
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
                  key={i.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {i.varianteNombre
                      ? `${i.productoNombre} (${i.varianteNombre})`
                      : i.productoNombre}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(i.id, i.cantidad - 1)}
                      className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                    >
                      −
                    </button>
                    {i.cantidad}
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(i.id, i.cantidad + 1)}
                      className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                    >
                      +
                    </button>
                    {editandoPrecioId === i.id ? (
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        defaultValue={i.precio}
                        onBlur={(e) => {
                          editarPrecio(i.id, Number(e.target.value));
                          setEditandoPrecioId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        className="w-20 rounded-md border border-zinc-300 px-1.5 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoPrecioId(i.id)}
                        title="Editar precio unitario"
                        className="w-20 text-right font-medium underline decoration-dotted"
                      >
                        {formatPrecio(i.precio * i.cantidad)}
                      </button>
                    )}
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
            <div className="relative">
              <label className="block text-sm font-medium">
                Buscar cliente existente
              </label>
              <input
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Nombre o teléfono…"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {resultadosCliente.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {resultadosCliente.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium">
                          {c.nombre} {c.apellido ?? ''}
                        </span>
                        {c.telefono && (
                          <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                            {c.telefono}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Apellido</label>
                <input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="block text-sm font-medium">
                  Correo (opcional)
                </label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium">Modalidad</span>
              <div className="mt-1 flex flex-wrap gap-4">
                {MODALIDAD_OPCIONES.map((op) => (
                  <label
                    key={op.valor}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="modalidad"
                      checked={modalidad === op.valor}
                      onChange={() => setModalidad(op.valor)}
                    />
                    {op.etiqueta}
                  </label>
                ))}
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
