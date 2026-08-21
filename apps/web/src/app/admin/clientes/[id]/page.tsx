'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { formatPrecio, formatFecha } from '@/lib/formato';
import { useRol } from '@/lib/use-rol';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type ClienteDetalle = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  puntos_actuales: number;
  puntos_ultima_actividad: string | null;
  total_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string | null;
};

type MovimientoPuntos = {
  id: string;
  tipo: 'ganado' | 'canjeado' | 'vencido' | 'ajuste';
  puntos: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  ganado: 'Ganado',
  canjeado: 'Canjeado',
  vencido: 'Vencido',
  ajuste: 'Ajuste manual',
};

const TIPO_COLOR: Record<string, string> = {
  ganado: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400',
  canjeado: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  vencido: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
  ajuste: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
};

function formatFechaHora(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function IconEstrella() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3l-6.2 3.5 1.6-6.8L2.2 9.4l6.9-.6L12 2.5Z" />
    </svg>
  );
}

export default function DetalleClientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { rol } = useRol();

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoPuntos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const [ajustePuntos, setAjustePuntos] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [ajustando, setAjustando] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null);

  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([
      adminFetch(`/admin/clientes/${params.id}`).then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el cliente.');
        return res.json();
      }),
      adminFetch(`/admin/clientes/${params.id}/movimientos-puntos`).then((res) =>
        res.ok ? res.json() : [],
      ),
    ])
      .then(([c, m]) => {
        setCliente(c);
        setMovimientos(m);
        setNombre(c.nombre);
        setApellido(c.apellido ?? '');
        setTelefono(c.telefono ?? '');
        setDireccion(c.direccion ?? '');
        setCorreo(c.correo ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido.'))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [params.id]);

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrorEdicion(null);
    try {
      const res = await adminFetch(`/admin/clientes/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre,
          apellido: apellido || null,
          telefono: telefono || null,
          direccion: direccion || null,
          correo: correo || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar.');
      }
      setEditando(false);
      cargar();
    } catch (err) {
      setErrorEdicion(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function registrarAjuste(e: React.FormEvent) {
    e.preventDefault();
    const puntos = Number(ajustePuntos);
    if (!Number.isFinite(puntos) || puntos === 0) {
      setErrorAjuste('Ingresá una cantidad distinta de cero.');
      return;
    }
    if (!ajusteMotivo.trim()) {
      setErrorAjuste('Escribí el motivo del ajuste.');
      return;
    }
    setAjustando(true);
    setErrorAjuste(null);
    try {
      const res = await adminFetch(`/admin/clientes/${params.id}/ajuste-puntos`, {
        method: 'POST',
        body: JSON.stringify({ puntos: Math.round(puntos), motivo: ajusteMotivo.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo registrar el ajuste.');
      }
      setAjustePuntos('');
      setAjusteMotivo('');
      cargar();
    } catch (err) {
      setErrorAjuste(err instanceof Error ? err.message : 'No se pudo registrar el ajuste.');
    } finally {
      setAjustando(false);
    }
  }

  async function eliminarCliente() {
    if (!cliente) return;
    const nombreCompleto = `${cliente.nombre} ${cliente.apellido ?? ''}`.trim();
    if (
      !window.confirm(
        `¿Eliminar a "${nombreCompleto}"? Esto solo funciona si el cliente no tiene pedidos registrados.`,
      )
    ) {
      return;
    }
    setEliminando(true);
    setErrorEliminar(null);
    try {
      const res = await adminFetch(`/admin/clientes/${params.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo eliminar el cliente.');
      }
      router.push('/admin/clientes');
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : 'No se pudo eliminar el cliente.');
      setEliminando(false);
    }
  }

  if (cargando) {
    return (
      <div className="p-8">
        <CargandoSkeleton filas={5} />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error ?? 'Cliente no encontrado.'}
        </p>
        <Link href="/admin/clientes" className="mt-4 inline-block text-sm text-brand-orange underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900';

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin/clientes')}
            className="text-sm text-zinc-500 hover:text-brand-orange dark:text-zinc-400"
          >
            ← Clientes
          </button>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {cliente.nombre} {cliente.apellido ?? ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {rol === 'admin' && (
            <button
              type="button"
              onClick={eliminarCliente}
              disabled={eliminando}
              title="Solo funciona si el cliente no tiene pedidos registrados"
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-400 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:border-red-700"
            >
              {eliminando ? 'Eliminando…' : 'Eliminar cliente'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange dark:border-zinc-700 dark:text-zinc-300"
          >
            {editando ? 'Cancelar' : 'Editar datos'}
          </button>
        </div>
      </div>

      {errorEliminar && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorEliminar}</p>
      )}

      {editando ? (
        <form
          onSubmit={guardarEdicion}
          className="mt-4 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium">Apellido</label>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium">Correo</label>
            <input value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Dirección</label>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputClass} />
          </div>
          {errorEdicion && (
            <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{errorEdicion}</p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="btn-press rounded-lg btn-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">Teléfono</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{cliente.telefono ?? '—'}</p>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Correo</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{cliente.correo ?? '—'}</p>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Dirección</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{cliente.direccion ?? '—'}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">Pedidos totales</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{cliente.total_pedidos}</p>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Total gastado</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {formatPrecio(cliente.total_gastado)}
            </p>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Último pedido</p>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {cliente.ultimo_pedido ? formatFecha(cliente.ultimo_pedido) : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-orange/25 bg-brand-orange/[0.06] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white">
          <IconEstrella />
        </span>
        <div>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {cliente.puntos_actuales} puntos
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {cliente.puntos_ultima_actividad
              ? `Última actividad: ${formatFecha(cliente.puntos_ultima_actividad)}`
              : 'Sin actividad todavía'}
          </p>
        </div>
      </div>

      {rol === 'admin' && (
        <form
          onSubmit={registrarAjuste}
          className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ajuste manual</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-[120px_1fr_auto]">
            <input
              type="number"
              placeholder="± puntos"
              value={ajustePuntos}
              onChange={(e) => setAjustePuntos(e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Motivo del ajuste"
              value={ajusteMotivo}
              onChange={(e) => setAjusteMotivo(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={ajustando}
              className="btn-press mt-1 h-fit self-end rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-brand-orange disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
            >
              {ajustando ? 'Guardando…' : 'Aplicar'}
            </button>
          </div>
          {errorAjuste && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorAjuste}</p>
          )}
        </form>
      )}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Historial de puntos
      </h2>
      {movimientos.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sin movimientos todavía.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Puntos</th>
                <th className="py-2 pr-2">Motivo / referencia</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2 text-zinc-500 dark:text-zinc-400">
                    {formatFechaHora(m.created_at)}
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
                      m.puntos >= 0
                        ? 'text-green-700 dark:text-green-500'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {m.puntos >= 0 ? '+' : ''}
                    {m.puntos}
                  </td>
                  <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                    {m.motivo ?? (m.referencia_tipo === 'pedido' ? 'Pedido' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
