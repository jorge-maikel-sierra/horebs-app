'use client';

import { useEffect, useState, type FormEvent } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';

function ConfiguracionInterna() {
  const [correoDomiciliario, setCorreoDomiciliario] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/admin/configuracion')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar la configuración.');
        const data = await res.json();
        setCorreoDomiciliario(data.correo_domiciliario ?? '');
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error desconocido.'),
      )
      .finally(() => setCargando(false));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/configuracion', {
        method: 'PATCH',
        body: JSON.stringify({ correo_domiciliario: correoDomiciliario }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo guardar.');
      }
      setMensaje('Guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Configuración
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cada vez que se cree un pedido con envío a domicilio (web o punto de
        venta), se le avisa por correo a esta dirección.
      </p>

      {cargando ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Cargando…
        </p>
      ) : (
        <form onSubmit={guardar} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">
              Correo del domiciliario
            </label>
            <input
              required
              type="email"
              value={correoDomiciliario}
              onChange={(e) => setCorreoDomiciliario(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {mensaje && <p className="text-sm text-brand-orange">{mensaje}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <RequireRol roles={['admin']}>
      <ConfiguracionInterna />
    </RequireRol>
  );
}
