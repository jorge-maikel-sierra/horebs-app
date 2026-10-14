'use client';

import type { ReactNode } from 'react';
import RequireRol from '@/components/RequireRol';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AdminSidebar />
        <div className="min-w-0 flex-1 pb-12">{children}</div>
      </div>
    </RequireRol>
  );
}
