'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';
import { useRol } from '@/lib/use-rol';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type ItemPedido = {
  variante_id: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
};

type ItemEdit = ItemPedido & { id: string };

type PedidoAdmin = {
  id: string;
  canal: 'web' | 'pos';
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    direccion: string | null;
    correo: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  stock_status: string;
  total: number;
  created_at: string;
  items: ItemPedido[];
};

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

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Para llevar',
  local: 'Comer en el local',
};

const METODO_PAGO_OPCIONES = ['efectivo', 'transferencia', 'tarjeta'] as const;

function PedidosInterno() {
  const { rol } = useRol();
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const [editandoClienteId, setEditandoClienteId] = useState<string | null>(
    null,
  );
  const [nombreEdit, setNombreEdit] = useState('');
  const [apellidoEdit, setApellidoEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [direccionEdit, setDireccionEdit] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const [editandoPedidoId, setEditandoPedidoId] = useState<string | null>(
    null,
  );
  const [itemsEdit, setItemsEdit] = useState<ItemEdit[]>([]);
  const [metodoPagoEdit, setMetodoPagoEdit] = useState<string>('efectivo');
  const [categoriaPickerId, setCategoriaPickerId] = useState<string | null>(
    null,
  );
  const [nombrePersonalizadoEdit, setNombrePersonalizadoEdit] = useState('');
  const [precioPersonalizadoEdit, setPrecioPersonalizadoEdit] = useState('');
  const [editandoPrecioEditId, setEditandoPrecioEditId] = useState<
    string | null
  >(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorPedido, setErrorPedido] = useState<string | null>(null);

  const [accionFacturaId, setAccionFacturaId] = useState<string | null>(null);
  const [mensajeFactura, setMensajeFactura] = useState<
    { id: string; texto: string; error: boolean } | null
  >(null);

  useEffect(() => {
    adminFetch('/admin/pedidos')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los pedidos.');
        setPedidos(await res.json());
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    Promise.all([
      fetch(`${apiUrl}/catalogo/categorias`).then((r) => r.json()),
      fetch(`${apiUrl}/catalogo/productos`).then((r) => r.json()),
    ]).then(([cats, prods]) => {
      setCategorias(cats);
      setProductosCatalogo(prods);
    });
  }, []);

  function empezarEdicion(p: PedidoAdmin) {
    setEditandoClienteId(p.cliente.id);
    setNombreEdit(p.cliente.nombre);
    setApellidoEdit(p.cliente.apellido ?? '');
    setTelefonoEdit(p.cliente.telefono ?? '');
    setDireccionEdit(p.cliente.direccion ?? '');
    setErrorEdit(null);
  }

  async function guardarCliente(clienteId: string) {
    setGuardandoCliente(true);
    setErrorEdit(null);
    try {
      const res = await adminFetch(`/admin/clientes/${clienteId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombreEdit,
          apellido: apellidoEdit,
          telefono: telefonoEdit,
          direccion: direccionEdit,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar el cliente.');
      }
      const clienteActualizado = await res.json();
      // El cliente es un registro compartido — reflejar el cambio en
      // todos los pedidos de la lista que le pertenecen, no solo el que
      // se estaba editando.
      setPedidos((prev) =>
        prev.map((p) =>
          p.cliente.id === clienteId
            ? {
                ...p,
                cliente: {
                  ...p.cliente,
                  nombre: clienteActualizado.nombre,
                  apellido: clienteActualizado.apellido,
                  telefono: clienteActualizado.telefono,
                  direccion: clienteActualizado.direccion,
                },
              }
            : p,
        ),
      );
      setEditandoClienteId(null);
    } catch (err) {
      setErrorEdit(
        err instanceof Error ? err.message : 'No se pudo guardar el cliente.',
      );
    } finally {
      setGuardandoCliente(false);
    }
  }

  function empezarEdicionPedido(p: PedidoAdmin) {
    setEditandoPedidoId(p.id);
    setItemsEdit(
      p.items.map((i) => ({ ...i, id: i.variante_id ?? crypto.randomUUID() })),
    );
    setMetodoPagoEdit(p.metodo_pago);
    setCategoriaPickerId(null);
    setNombrePersonalizadoEdit('');
    setPrecioPersonalizadoEdit('');
    setEditandoPrecioEditId(null);
    setErrorPedido(null);
  }

  function actualizarCantidadEdit(id: string, cantidad: number) {
    if (cantidad <= 0) {
      setItemsEdit((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItemsEdit((prev) =>
      prev.map((i) => (i.id === id ? { ...i, cantidad } : i)),
    );
  }

  function agregarProductoEdit(producto: Producto, variante: Variante) {
    setItemsEdit((prev) => {
      const existente = prev.find((i) => i.variante_id === variante.id);
      if (existente) {
        return prev.map((i) =>
          i.variante_id === variante.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: variante.id,
          variante_id: variante.id,
          producto_nombre: producto.nombre,
          variante_nombre: variante.nombre,
          cantidad: 1,
          precio_unitario: variante.precio_oferta ?? variante.precio,
        },
      ];
    });
  }

  function agregarPersonalizadoEdit() {
    const nombre = nombrePersonalizadoEdit.trim();
    const precio = Number(precioPersonalizadoEdit);
    if (!nombre) {
      setErrorPedido('Escribí el nombre del producto personalizado.');
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setErrorPedido('El precio del producto personalizado no es válido.');
      return;
    }
    setErrorPedido(null);
    setItemsEdit((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variante_id: null,
        producto_nombre: nombre,
        variante_nombre: '',
        cantidad: 1,
        precio_unitario: precio,
      },
    ]);
    setNombrePersonalizadoEdit('');
    setPrecioPersonalizadoEdit('');
  }

  function editarPrecioEdit(id: string, precio: number) {
    if (!Number.isFinite(precio) || precio < 0) return;
    setItemsEdit((prev) =>
      prev.map((i) => (i.id === id ? { ...i, precio_unitario: precio } : i)),
    );
  }

  async function guardarPedido(pedidoId: string) {
    setErrorPedido(null);
    if (itemsEdit.length === 0) {
      setErrorPedido('El pedido no puede quedar sin productos.');
      return;
    }
    setGuardandoPedido(true);
    try {
      const res = await adminFetch(`/admin/pedidos/${pedidoId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          metodo_pago: metodoPagoEdit,
          items: itemsEdit.map((i) =>
            i.variante_id
              ? {
                  variante_id: i.variante_id,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio_unitario,
                }
              : {
                  nombre_personalizado: i.producto_nombre,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio_unitario,
                },
          ),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar el pedido.');
      }
      const actualizado: PedidoAdmin = await res.json();
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? actualizado : p)),
      );
      setEditandoPedidoId(null);
    } catch (err) {
      setErrorPedido(
        err instanceof Error ? err.message : 'No se pudo guardar el pedido.',
      );
    } finally {
      setGuardandoPedido(false);
    }
  }

  async function eliminarPedido(p: PedidoAdmin) {
    const nombre = p.cliente.nombre
      ? `${p.cliente.nombre} ${p.cliente.apellido ?? ''}`.trim()
      : 'este pedido';
    if (
      !window.confirm(
        `¿Eliminar el pedido de ${nombre} por ${formatPrecio(p.total)}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setEliminandoId(p.id);
    setMensajeFactura(null);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo eliminar el pedido.');
      }
      setPedidos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setMensajeFactura({
        id: p.id,
        texto: err instanceof Error ? err.message : 'No se pudo eliminar el pedido.',
        error: true,
      });
    } finally {
      setEliminandoId(null);
    }
  }

  async function descargarFactura(p: PedidoAdmin) {
    setAccionFacturaId(`${p.id}-descargar`);
    setMensajeFactura(null);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}/factura`);
      if (!res.ok) throw new Error('No se pudo generar el comprobante.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante-${p.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMensajeFactura({
        id: p.id,
        texto: err instanceof Error ? err.message : 'No se pudo descargar.',
        error: true,
      });
    } finally {
      setAccionFacturaId(null);
    }
  }

  async function enviarFacturaPorCorreo(p: PedidoAdmin) {
    setAccionFacturaId(`${p.id}-correo`);
    setMensajeFactura(null);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}/factura/correo`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar el correo.');
      setMensajeFactura({ id: p.id, texto: `Enviado a ${body.destino}.`, error: false });
    } catch (err) {
      setMensajeFactura({
        id: p.id,
        texto: err instanceof Error ? err.message : 'No se pudo enviar el correo.',
        error: true,
      });
    } finally {
      setAccionFacturaId(null);
    }
  }

  async function enviarFacturaPorWhatsapp(p: PedidoAdmin) {
    setAccionFacturaId(`${p.id}-whatsapp`);
    setMensajeFactura(null);
    try {
      const res = await adminFetch(`/admin/pedidos/${p.id}/factura/whatsapp`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo enviar por WhatsApp.');
      setMensajeFactura({ id: p.id, texto: 'Enviado por WhatsApp.', error: false });
    } catch (err) {
      setMensajeFactura({
        id: p.id,
        texto: err instanceof Error ? err.message : 'No se pudo enviar por WhatsApp.',
        error: true,
      });
    } finally {
      setAccionFacturaId(null);
    }
  }

  const productosDeCategoria = categoriaPickerId
    ? productosCatalogo.filter((p) => p.categoria_id === categoriaPickerId)
    : [];

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      p.cliente.nombre.toLowerCase().includes(q) ||
      (p.cliente.apellido ?? '').toLowerCase().includes(q) ||
      (p.cliente.telefono ?? '').includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pedidos
        </h1>
        <Link
          href="/admin/pos"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300"
        >
          Volver al POS
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Últimos {pedidos.length} pedidos, web y del local.
      </p>

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por nombre o teléfono del cliente…"
        className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {cargando && <CargandoSkeleton filas={5} />}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!cargando && !error && pedidos.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no hay pedidos registrados.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {pedidosFiltrados.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
                    p.canal === 'pos' ? 'bg-brand-navy' : 'bg-brand-orange'
                  }`}
                >
                  {p.canal === 'pos' ? 'Local' : 'Web'}
                </span>
                {p.stock_status === 'pendiente' && (
                  <span
                    title="El descuento automático de stock falló para este pedido — revisar el inventario a mano."
                    className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    ⚠️ Stock pendiente
                  </span>
                )}
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {p.cliente.nombre
                    ? `${p.cliente.nombre} ${p.cliente.apellido ?? ''}`.trim()
                    : 'Cliente sin nombre'}
                </span>
                {p.cliente.telefono && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {p.cliente.telefono}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => empezarEdicion(p)}
                  className="text-xs text-brand-orange underline"
                >
                  Editar cliente
                </button>
                <button
                  type="button"
                  onClick={() => empezarEdicionPedido(p)}
                  className="text-xs text-brand-orange underline"
                >
                  Editar pedido
                </button>
                {rol === 'admin' && (
                  <button
                    type="button"
                    disabled={eliminandoId === p.id}
                    onClick={() => eliminarPedido(p)}
                    className="text-xs text-red-600 underline disabled:opacity-50 dark:text-red-400"
                  >
                    {eliminandoId === p.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                )}
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatFecha(p.created_at)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
              <button
                type="button"
                disabled={accionFacturaId === `${p.id}-descargar`}
                onClick={() => descargarFactura(p)}
                className="text-xs font-medium text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400"
              >
                {accionFacturaId === `${p.id}-descargar` ? 'Generando…' : 'Descargar comprobante'}
              </button>
              <button
                type="button"
                disabled={accionFacturaId === `${p.id}-correo` || !p.cliente.correo}
                title={!p.cliente.correo ? 'El cliente no tiene correo registrado' : undefined}
                onClick={() => enviarFacturaPorCorreo(p)}
                className="text-xs font-medium text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400"
              >
                {accionFacturaId === `${p.id}-correo` ? 'Enviando…' : 'Enviar a correo'}
              </button>
              <button
                type="button"
                disabled={accionFacturaId === `${p.id}-whatsapp` || !p.cliente.telefono}
                title={!p.cliente.telefono ? 'El cliente no tiene teléfono registrado' : undefined}
                onClick={() => enviarFacturaPorWhatsapp(p)}
                className="text-xs font-medium text-green-700 underline disabled:opacity-50 dark:text-green-500"
              >
                {accionFacturaId === `${p.id}-whatsapp` ? 'Enviando…' : 'Enviar a WhatsApp'}
              </button>
              {mensajeFactura?.id === p.id && (
                <span
                  className={`text-xs ${mensajeFactura.error ? 'text-red-600 dark:text-red-400' : 'text-brand-orange'}`}
                >
                  {mensajeFactura.texto}
                </span>
              )}
            </div>

            {editandoClienteId === p.cliente.id && (
              <div className="mt-3 space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    placeholder="Nombre"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    value={apellidoEdit}
                    onChange={(e) => setApellidoEdit(e.target.value)}
                    placeholder="Apellido"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    value={telefonoEdit}
                    onChange={(e) => setTelefonoEdit(e.target.value)}
                    placeholder="Teléfono"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    value={direccionEdit}
                    onChange={(e) => setDireccionEdit(e.target.value)}
                    placeholder="Dirección guardada del cliente"
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                {errorEdit && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errorEdit}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={guardandoCliente}
                    onClick={() => guardarCliente(p.cliente.id)}
                    className="rounded-md bg-brand-orange px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {guardandoCliente ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoClienteId(null)}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {editandoPedidoId === p.id ? (
              <div className="mt-3 space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                <div>
                  <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Productos
                  </span>
                  {itemsEdit.length === 0 ? (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Sin productos — agregá al menos uno.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {itemsEdit.map((i) => (
                        <li
                          key={i.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {i.variante_nombre
                              ? `${i.producto_nombre} (${i.variante_nombre})`
                              : i.producto_nombre}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                actualizarCantidadEdit(i.id, i.cantidad - 1)
                              }
                              className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                            >
                              −
                            </button>
                            {i.cantidad}
                            <button
                              type="button"
                              onClick={() =>
                                actualizarCantidadEdit(i.id, i.cantidad + 1)
                              }
                              className="h-6 w-6 rounded-full border border-zinc-300 text-xs dark:border-zinc-700"
                            >
                              +
                            </button>
                            {editandoPrecioEditId === i.id ? (
                              <input
                                type="number"
                                min={0}
                                autoFocus
                                defaultValue={i.precio_unitario}
                                onBlur={(e) => {
                                  editarPrecioEdit(i.id, Number(e.target.value));
                                  setEditandoPrecioEditId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-20 rounded-md border border-zinc-300 px-1.5 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditandoPrecioEditId(i.id)}
                                title="Editar precio unitario"
                                className="w-20 text-right underline decoration-dotted"
                              >
                                {formatPrecio(i.precio_unitario * i.cantidad)}
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Producto personalizado
                  </span>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Para bordes, adicionales o algo que no esté en el
                    catálogo.
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input
                      value={nombrePersonalizadoEdit}
                      onChange={(e) =>
                        setNombrePersonalizadoEdit(e.target.value)
                      }
                      placeholder="Ej: Borde de queso"
                      className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={precioPersonalizadoEdit}
                      onChange={(e) =>
                        setPrecioPersonalizadoEdit(e.target.value)
                      }
                      placeholder="Precio"
                      className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={agregarPersonalizadoEdit}
                      className="shrink-0 rounded-md bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Agregar producto
                  </span>
                  {!categoriaPickerId ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {categorias.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoriaPickerId(cat.id)}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700"
                        >
                          {cat.nombre}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setCategoriaPickerId(null)}
                        className="text-xs text-brand-orange underline"
                      >
                        ← Volver a categorías
                      </button>
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                        {productosDeCategoria.map((producto) => (
                          <div key={producto.id}>
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                              {producto.nombre}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {producto.variantes.map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() =>
                                    agregarProductoEdit(producto, v)
                                  }
                                  className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-90"
                                >
                                  + {v.nombre}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Método de pago
                  </span>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {METODO_PAGO_OPCIONES.map((m) => (
                      <label
                        key={m}
                        className="flex items-center gap-1.5 text-sm capitalize"
                      >
                        <input
                          type="radio"
                          name={`metodoPago-${p.id}`}
                          checked={metodoPagoEdit === m}
                          onChange={() => setMetodoPagoEdit(m)}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>

                {errorPedido && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errorPedido}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={guardandoPedido}
                    onClick={() => guardarPedido(p.id)}
                    className="rounded-md bg-brand-orange px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {guardandoPedido ? 'Guardando…' : 'Guardar pedido'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoPedidoId(null)}
                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <ul className="mt-2 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {p.items.map((i, idx) => (
                  <li key={i.variante_id ?? idx}>
                    {i.cantidad}×{' '}
                    {i.variante_nombre
                      ? `${i.producto_nombre} (${i.variante_nombre})`
                      : i.producto_nombre}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-3 text-zinc-500 dark:text-zinc-400">
                <span>{MODALIDAD_LABEL[p.modalidad] ?? p.modalidad}</span>
                {p.direccion_entrega && <span>{p.direccion_entrega}</span>}
                <span className="capitalize">{p.metodo_pago}</span>
                <span className="capitalize">{p.estado}</span>
              </div>
              <span className="font-semibold text-brand-orange">
                {formatPrecio(p.total)}
                {p.costo_domicilio > 0 && (
                  <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                    (incl. {formatPrecio(p.costo_domicilio)} domicilio)
                  </span>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PedidosPage() {
  return <PedidosInterno />;
}
