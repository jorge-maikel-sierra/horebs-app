'use client';

import { useEffect, useState } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio } from '@/lib/formato';

type ItemPedido = {
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
};

type PedidoAdmin = {
  id: string;
  canal: 'web' | 'pos';
  cliente: {
    id: string;
    nombre: string;
    telefono: string | null;
    direccion: string | null;
  };
  modalidad: string;
  direccion_entrega: string | null;
  costo_domicilio: number;
  metodo_pago: string;
  estado: string;
  total: number;
  created_at: string;
  items: ItemPedido[];
};

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Retiro en local',
  mostrador: 'Mostrador',
};

function PedidosInterno() {
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const [editandoClienteId, setEditandoClienteId] = useState<string | null>(
    null,
  );
  const [nombreEdit, setNombreEdit] = useState('');
  const [telefonoEdit, setTelefonoEdit] = useState('');
  const [direccionEdit, setDireccionEdit] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

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
  }, []);

  function empezarEdicion(p: PedidoAdmin) {
    setEditandoClienteId(p.cliente.id);
    setNombreEdit(p.cliente.nombre);
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

  const pedidosFiltrados = pedidos.filter((p) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      p.cliente.nombre.toLowerCase().includes(q) ||
      (p.cliente.telefono ?? '').includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Pedidos
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Últimos {pedidos.length} pedidos, web y de mostrador.
      </p>

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por nombre o teléfono del cliente…"
        className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {cargando && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Cargando…
        </p>
      )}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

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
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {p.cliente.nombre || 'Cliente sin nombre'}
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
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatFecha(p.created_at)}
              </span>
            </div>

            {editandoClienteId === p.cliente.id && (
              <div className="mt-3 space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    placeholder="Nombre"
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
                  <p className="text-xs text-red-600">{errorEdit}</p>
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

            <ul className="mt-2 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {p.items.map((i, idx) => (
                <li key={idx}>
                  {i.cantidad}× {i.producto_nombre} ({i.variante_nombre})
                </li>
              ))}
            </ul>

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
  return (
    <RequireRol roles={['admin']}>
      <PedidosInterno />
    </RequireRol>
  );
}
