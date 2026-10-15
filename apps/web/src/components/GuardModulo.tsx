'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import ModuloIcono from '@/components/ModuloIcono';
import { moduloDeRuta } from '@/lib/modulos';
import { useModulos } from '@/lib/use-modulos';
import { useRol } from '@/lib/use-rol';

/**
 * Bloquea la pantalla de un módulo apagado. Va en el layout del panel, así
 * cubre cualquier ruta bajo /admin sin tocar cada página.
 */
export default function GuardModulo({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { rol } = useRol();
  const { cargando, activo } = useModulos();
  const modulo = moduloDeRuta(pathname);

  if (!modulo) return <>{children}</>;

  if (cargando) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <CargandoSkeleton filas={4} />
      </div>
    );
  }

  if (activo(modulo.id)) return <>{children}</>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card-gradient mx-auto mt-6 flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <ModuloIcono id={modulo.id} tamano={26} />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Módulo desactivado: {modulo.etiqueta}
        </h1>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {rol === 'admin'
            ? 'Puedes volver a activarlo cuando quieras desde Configuración.'
            : 'El administrador lo desactivó por ahora. Si lo necesitas, pídele que lo active.'}
        </p>
        <Link
          href={rol === 'admin' ? '/admin/configuracion' : '/admin'}
          className="btn-gradient btn-press mt-5 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {rol === 'admin' ? 'Ir a Configuración' : 'Volver al panel'}
        </Link>
      </div>
    </div>
  );
}
