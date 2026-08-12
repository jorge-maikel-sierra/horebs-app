'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/inventario', label: 'Insumos' },
  { href: '/admin/inventario/compras', label: 'Compras' },
  { href: '/admin/inventario/recetas', label: 'Recetas' },
];

export default function InventarioTabs() {
  const pathname = usePathname();

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
