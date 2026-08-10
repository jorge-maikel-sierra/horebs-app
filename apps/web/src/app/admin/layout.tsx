'use client';

import type { ReactNode } from 'react';
import RequireRol from '@/components/RequireRol';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 sm:flex-row sm:px-6 sm:py-8">
        <AdminSidebar />
        <div className="min-w-0 flex-1 pb-12">{children}</div>
      </div>
    </RequireRol>
  );
}
