'use client';

import Link from 'next/link';
import { IconConfig, IconUsuarios } from '@/components/admin-iconos';
import ModuloIcono from '@/components/ModuloIcono';
import { MODULOS } from '@/lib/modulos';
import { useModulos } from '@/lib/use-modulos';
import type { Rol } from '@/lib/use-rol';
import { IconFlechaDerecha } from './iconos';

// Informes y Blog son del dueño; el resto lo usa todo el personal. Mismo
// criterio que el menú lateral.
const SOLO_ADMIN = new Set(['informes', 'blog']);

type Acceso = {
  clave: string;
  href: string;
  etiqueta: string;
  descripcion: string;
  icono: React.ReactNode;
  destacado?: boolean;
};

export default function AccesosModulos({ rol }: { rol: Rol | null }) {
  const { activo } = useModulos();

  const accesos: Acceso[] = MODULOS.filter(
    (m) => activo(m.id) && (rol === 'admin' || !SOLO_ADMIN.has(m.id)),
  ).map((m) => ({
    clave: m.id,
    href: m.href,
    etiqueta: m.etiqueta,
    descripcion: m.descripcion,
    icono: <ModuloIcono id={m.id} tamano={22} />,
    destacado: m.id === 'pos',
  }));

  if (rol === 'admin') {
    accesos.push(
      {
        clave: 'usuarios',
        href: '/admin/usuarios',
        etiqueta: 'Usuarios',
        descripcion: 'Quién puede entrar al panel y con qué rol.',
        icono: <IconUsuarios tamano={22} />,
      },
      {
        clave: 'configuracion',
        href: '/admin/configuracion',
        etiqueta: 'Configuración',
        descripcion: 'Avisos y módulos que se muestran en el panel.',
        icono: <IconConfig tamano={22} />,
      },
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {accesos.map((a) => (
        <li key={a.clave} className="min-w-0">
          <Link
            href={a.href}
            className={`card-interactive group flex h-full items-start gap-3 rounded-2xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
              a.destacado
                ? 'btn-gradient border-transparent text-white shadow-md shadow-brand-orange/25'
                : 'card-gradient border-zinc-200 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50'
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                a.destacado
                  ? 'bg-white/20 text-white'
                  : 'bg-brand-orange/15 text-accent-ink'
              }`}
            >
              {a.icono}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold">{a.etiqueta}</span>
                <span
                  className={`transition-transform group-hover:translate-x-0.5 ${
                    a.destacado
                      ? 'text-white'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  <IconFlechaDerecha />
                </span>
              </span>
              <span
                className={`mt-0.5 block text-xs leading-relaxed ${
                  a.destacado
                    ? 'text-white/90'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {a.descripcion}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
