'use client';

import Link from 'next/link';
import { useRol } from '@/lib/use-rol';

function IconPos() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 8h10l1 12H3L4 8Z" />
    </svg>
  );
}

function IconPedidos() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 8.5a3 3 0 1 1 3.2 3M21 20c0-2.8-1.9-5.1-4.5-5.8" />
    </svg>
  );
}

function IconBlog() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h9l5 5v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export default function AdminPage() {
  const { rol } = useRol();

  return (
    <div className="p-8">
      <h1 className="animate-fade-up text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Hola 👋
      </h1>
      <p className="animate-fade-up delay-1 mt-1 text-zinc-600 dark:text-zinc-400">
        Sesión de <span className="capitalize">{rol ?? '…'}</span> — accesos
        rápidos abajo, o usá el menú de la izquierda.
      </p>

      <div className="animate-fade-up delay-2 mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/pos"
          className="card-interactive btn-gradient flex flex-col gap-3 rounded-2xl p-6 text-white shadow-sm"
        >
          <IconPos />
          <div>
            <p className="text-lg font-bold">Punto de venta</p>
            <p className="mt-0.5 text-sm text-white/85">
              Registrar una venta directo del local
            </p>
          </div>
        </Link>
        <Link
          href="/admin/pedidos"
          className="card-interactive flex flex-col gap-3 rounded-2xl border border-zinc-200 p-6 text-zinc-900 shadow-sm dark:border-zinc-800 dark:text-zinc-50"
          style={{
            backgroundImage:
              'linear-gradient(165deg, color-mix(in srgb, var(--brand-navy) 14%, var(--background)) 0%, var(--background) 55%, color-mix(in srgb, var(--brand-navy) 8%, var(--background)) 100%)',
          }}
        >
          <span className="text-brand-navy dark:text-blue-300">
            <IconPedidos />
          </span>
          <div>
            <p className="text-lg font-bold">Pedidos</p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Ver y gestionar los pedidos que van llegando
            </p>
          </div>
        </Link>
      </div>

      {rol === 'admin' && (
        <div className="animate-fade-up delay-3 mt-8">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Administración
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/usuarios"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconUsuarios />
              </span>
              <span className="text-sm font-semibold">Usuarios</span>
            </Link>
            <Link
              href="/admin/blog"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconBlog />
              </span>
              <span className="text-sm font-semibold">Blog</span>
            </Link>
            <Link
              href="/admin/configuracion"
              className="card-interactive card-gradient flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
            >
              <span className="text-brand-orange">
                <IconConfig />
              </span>
              <span className="text-sm font-semibold">Configuración</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
