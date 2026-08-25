'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRol } from '@/lib/use-rol';
import { supabase } from '@/lib/supabase';

const CLAVE_COLAPSADO = 'horebs-admin-sidebar-colapsado';

function IconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconPos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8V6a3 3 0 0 1 6 0v2" />
      <path d="M4 8h10l1 12H3L4 8Z" />
    </svg>
  );
}

function IconPedidos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconClientes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <path d="M16.5 4.5a3 3 0 0 1 0 5.9" />
    </svg>
  );
}

function IconNomina() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 8.5a3 3 0 1 1 3.2 3M21 20c0-2.8-1.9-5.1-4.5-5.8" />
    </svg>
  );
}

function IconBlog() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h9l5 5v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function IconInventario() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function IconInformes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M13 16V8M18 16v-7" />
    </svg>
  );
}

function IconSeguimiento() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 1 1-4.4-7.4" />
      <path d="M21 3v6h-6" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconVolver() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21V12h6v9" />
      <path d="M3 10.5 12 3l9 7.5" />
    </svg>
  );
}

function IconSalir() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function IconCerrar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: () => ReactElement;
  exacto?: boolean;
};

const NAV_GENERAL: NavItem[] = [
  { href: '/admin', label: 'Panel', icon: IconPanel, exacto: true },
  { href: '/admin/pos', label: 'Punto de venta', icon: IconPos },
  { href: '/admin/pedidos', label: 'Pedidos', icon: IconPedidos },
  { href: '/admin/clientes', label: 'Clientes', icon: IconClientes },
  { href: '/admin/inventario', label: 'Inventario', icon: IconInventario },
  { href: '/admin/nomina', label: 'Nómina', icon: IconNomina },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/admin/informes', label: 'Informes', icon: IconInformes },
  { href: '/admin/seguimiento', label: 'Seguimiento del bot', icon: IconSeguimiento },
  { href: '/admin/usuarios', label: 'Usuarios', icon: IconUsuarios },
  { href: '/admin/blog', label: 'Blog', icon: IconBlog },
  { href: '/admin/configuracion', label: 'Configuración', icon: IconConfig },
];

function NavLink({
  item,
  activo,
  colapsado,
  onClick,
}: {
  item: NavItem;
  activo: boolean;
  colapsado: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={colapsado ? item.label : undefined}
      aria-label={item.label}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        colapsado ? 'justify-center' : ''
      } ${
        activo
          ? 'btn-gradient text-white shadow-sm'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
      }`}
    >
      <span className="shrink-0">
        <Icon />
      </span>
      {!colapsado && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarContenido({
  pathname,
  rol,
  email,
  colapsado = false,
  onNavigate,
  onCerrarSesion,
}: {
  pathname: string;
  rol: string | null;
  email: string | null;
  colapsado?: boolean;
  onNavigate: () => void;
  onCerrarSesion: () => void;
}) {
  function esActivo(item: NavItem) {
    return item.exacto
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2 px-2 ${colapsado ? 'justify-center px-0' : ''}`}>
        <span className="btn-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm">
          PH
        </span>
        {!colapsado && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Pizzería Horebs
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Panel de gestión
            </p>
          </div>
        )}
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-1">
        <div>
          {!colapsado && (
            <p className="px-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
              General
            </p>
          )}
          <div className={`space-y-1 ${colapsado ? '' : 'mt-2'}`}>
            {NAV_GENERAL.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                activo={esActivo(item)}
                colapsado={colapsado}
                onClick={onNavigate}
              />
            ))}
          </div>
        </div>

        {rol === 'admin' && (
          <div>
            {!colapsado && (
              <p className="px-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                Administración
              </p>
            )}
            <div className={`space-y-1 ${colapsado ? '' : 'mt-2'}`}>
              {NAV_ADMIN.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  activo={esActivo(item)}
                  colapsado={colapsado}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="mt-4 space-y-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 ${colapsado ? 'justify-center px-0' : ''}`}
          title={colapsado ? (email ?? undefined) : undefined}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-xs font-semibold text-brand-orange">
            {(email ?? '?').charAt(0).toUpperCase()}
          </span>
          {!colapsado && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                {email}
              </p>
              <p className="text-xs text-zinc-500 capitalize dark:text-zinc-400">
                {rol}
              </p>
            </div>
          )}
        </div>
        <Link
          href="/"
          title={colapsado ? 'Volver al sitio' : undefined}
          aria-label="Volver al sitio"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 ${
            colapsado ? 'justify-center' : ''
          }`}
        >
          <IconVolver />
          {!colapsado && 'Volver al sitio'}
        </Link>
        <button
          type="button"
          onClick={onCerrarSesion}
          title={colapsado ? 'Cerrar sesión' : undefined}
          aria-label="Cerrar sesión"
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 ${
            colapsado ? 'justify-center' : ''
          }`}
        >
          <IconSalir />
          {!colapsado && 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, rol } = useRol();
  const [abierto, setAbierto] = useState(false);
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    setColapsado(localStorage.getItem(CLAVE_COLAPSADO) === '1');
  }, []);

  function alternarColapsado() {
    setColapsado((prev) => {
      const siguiente = !prev;
      localStorage.setItem(CLAVE_COLAPSADO, siguiente ? '1' : '0');
      return siguiente;
    });
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:hidden dark:border-zinc-800 dark:bg-black/90">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Panel
        </span>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú del panel"
          aria-expanded={abierto}
          className="btn-press flex h-9 w-9 items-center justify-center text-zinc-700 dark:text-zinc-300"
        >
          <IconMenu />
        </button>
      </div>

      <aside
        className={`hidden shrink-0 transition-[width] duration-200 sm:block ${
          colapsado ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <div className="card-gradient relative sticky top-6 max-h-[calc(100vh-3rem)] rounded-2xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
          <button
            type="button"
            onClick={alternarColapsado}
            aria-label={colapsado ? 'Expandir panel' : 'Colapsar panel'}
            title={colapsado ? 'Expandir panel' : 'Colapsar panel'}
            className="btn-press absolute top-6 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:text-brand-orange dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <span className={`transition-transform duration-200 ${colapsado ? '' : 'rotate-180'}`}>
              <IconChevron />
            </span>
          </button>
          <SidebarContenido
            pathname={pathname}
            rol={rol}
            email={session?.user.email ?? null}
            colapsado={colapsado}
            onNavigate={() => {}}
            onCerrarSesion={() => setConfirmandoSalir(true)}
          />
        </div>
      </aside>

      {abierto && (
        <div className="fixed inset-0 z-30 sm:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/40"
            onClick={() => setAbierto(false)}
          />
          <div className="animate-fade-up absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú del panel"
                className="btn-press p-1 text-zinc-500"
              >
                <IconCerrar />
              </button>
            </div>
            <SidebarContenido
              pathname={pathname}
              rol={rol}
              email={session?.user.email ?? null}
              onNavigate={() => setAbierto(false)}
              onCerrarSesion={() => setConfirmandoSalir(true)}
            />
          </div>
        </div>
      )}

      {confirmandoSalir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="animate-fade-in absolute inset-0" onClick={() => setConfirmandoSalir(false)} />
          <div className="animate-fade-up relative w-full max-w-sm rounded-lg bg-white p-6 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              ¿Cerrar sesión?
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Vas a salir del panel de gestión. Vas a tener que volver a
              iniciar sesión para entrar de nuevo.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoSalir(false)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={cerrarSesion}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
