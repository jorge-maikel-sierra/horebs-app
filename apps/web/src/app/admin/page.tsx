'use client';

import Link from 'next/link';
import RequireRol from '@/components/RequireRol';
import { useRol } from '@/lib/use-rol';

function AdminHome() {
  const { rol } = useRol();

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Panel
      </h1>
      <div className="mt-6 space-y-3">
        <Link
          href="/admin/pos"
          className="block rounded-lg border border-zinc-200 p-4 font-semibold text-zinc-900 hover:border-brand-orange dark:border-zinc-800 dark:text-zinc-50"
        >
          Punto de venta
        </Link>
        {rol === 'admin' && (
          <Link
            href="/admin/usuarios"
            className="block rounded-lg border border-zinc-200 p-4 font-semibold text-zinc-900 hover:border-brand-orange dark:border-zinc-800 dark:text-zinc-50"
          >
            Usuarios
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <AdminHome />
    </RequireRol>
  );
}
