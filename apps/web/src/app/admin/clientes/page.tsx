'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { useRol } from '@/lib/use-rol';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type Cliente = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
};

type ConfiguracionPuntos = {
  puntosPor1000Pesos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
  puntosVencimientoMeses: number;
};

function IconConfig() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function PanelConfiguracion() {
  const [config, setConfig] = useState<ConfiguracionPuntos | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || config) return;
    adminFetch('/admin/puntos/configuracion')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setConfig(data));
  }, [abierto, config]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await adminFetch('/admin/puntos/configuracion', {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('No se pudo guardar.');
      setMensaje('Configuración guardada.');
    } catch {
      setMensaje('No se pudo guardar la configuración.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="btn-press flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <IconConfig />
          Programa de fidelidad
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {abierto ? 'Ocultar' : 'Configurar'}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          {!config ? (
            <CargandoSkeleton filas={1} />
          ) : (
            <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">
                  Puntos por cada $1.000 gastados
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.puntosPor1000Pesos}
                  onChange={(e) =>
                    setConfig({ ...config, puntosPor1000Pesos: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Valor de cada punto (pesos)
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.valorPuntoPesos}
                  onChange={(e) =>
                    setConfig({ ...config, valorPuntoPesos: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Mínimo de puntos para canjear
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.puntosMinimoCanje}
                  onChange={(e) =>
                    setConfig({ ...config, puntosMinimoCanje: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Vencimiento por inactividad (meses)
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.puntosVencimientoMeses}
                  onChange={(e) =>
                    setConfig({ ...config, puntosVencimientoMeses: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="btn-press rounded-lg btn-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                {mensaje && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{mensaje}</span>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminClientesPage() {
  const { rol } = useRol();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    setCargando(true);
    const query = busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : '';
    const timeout = setTimeout(() => {
      adminFetch(`/admin/clientes${query}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('No se pudo cargar la lista de clientes.');
          setClientes(await res.json());
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido.'))
        .finally(() => setCargando(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [busqueda]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Clientes</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Historial de compras y saldo de puntos de fidelidad.
      </p>

      {rol === 'admin' && <PanelConfiguracion />}

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, apellido o teléfono…"
        className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {cargando && <CargandoSkeleton filas={5} />}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!cargando && !error && clientes.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {busqueda ? 'No se encontraron clientes.' : 'Todavía no hay clientes registrados.'}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clientes/${c.id}`}
            className="card-interactive flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
              {c.nombre} {c.apellido ?? ''}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {c.telefono ?? 'Sin teléfono'}
            </p>
            {c.correo && (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {c.correo}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
