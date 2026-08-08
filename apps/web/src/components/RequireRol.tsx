'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRol, type Rol } from '@/lib/use-rol';

export default function RequireRol({
  roles,
  children,
}: {
  roles: Rol[];
  children: ReactNode;
}) {
  const { cargando, session, rol } = useRol();

  if (cargando) return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Necesitás iniciar sesión para ver esta página.
        </p>
        <Link
          href="/cuenta"
          className="mt-4 inline-block text-brand-orange underline"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  if (!rol || !roles.includes(rol)) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Tu cuenta no tiene permiso para ver esta página.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
