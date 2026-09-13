'use client';

import type { ReactNode } from 'react';
import RequireRol from '@/components/RequireRol';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <div className="flex min-h-screen flex-col sm:flex-row">
        <AdminSidebar />
        <div className="min-w-0 flex-1 px-4 py-4 pb-12 sm:px-6 sm:py-8">{children}</div>
      </div>
    </RequireRol>
  );
}
