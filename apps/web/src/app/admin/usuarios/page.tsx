'use client';

import { useEffect, useState, type FormEvent } from 'react';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import type { Rol } from '@/lib/use-rol';
import CargandoSkeleton from '@/components/CargandoSkeleton';

type UsuarioStaff = { id: string; email: string; rol: Rol; created_at: string };

function UsuariosInterno() {
  const [usuarios, setUsuarios] = useState<UsuarioStaff[]>([]);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState('');
  const [rolNuevo, setRolNuevo] = useState<Rol>('empleado');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargarUsuarios() {
    setCargando(true);
    const res = await adminFetch('/admin/usuarios');
    if (res.ok) setUsuarios(await res.json());
    setCargando(false);
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function asignar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await adminFetch('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({ email, rol: rolNuevo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo asignar el rol.');
      }
      setEmail('');
      await cargarUsuarios();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo asignar el rol.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(id: string) {
    await adminFetch(`/admin/usuarios/${id}`, { method: 'DELETE' });
    await cargarUsuarios();
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Usuarios
      </h1>

      <form onSubmit={asignar} className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Rol</label>
          <select
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as Rol)}
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="empleado">Empleado</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Asignar
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        La persona tiene que haberse registrado antes en /cuenta — recién ahí
        se le puede asignar un rol.
      </p>

      <div className="mt-8">
        {cargando ? (
          <CargandoSkeleton filas={4} />
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay usuarios con rol asignado.
          </p>
        ) : (
          <ul className="space-y-2">
            {usuarios.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {u.email}
                  </p>
                  <p className="text-xs text-zinc-500 capitalize dark:text-zinc-400">
                    {u.rol}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quitar(u.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <RequireRol roles={['admin']}>
      <UsuariosInterno />
    </RequireRol>
  );
}
