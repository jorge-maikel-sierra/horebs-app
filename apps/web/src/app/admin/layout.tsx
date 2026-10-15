'use client';

import type { ReactNode } from 'react';
import RequireRol from '@/components/RequireRol';
import AdminSidebar from '@/components/AdminSidebar';
import GuardModulo from '@/components/GuardModulo';
import { ModulosProvider } from '@/lib/use-modulos';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRol roles={['admin', 'empleado']}>
      <ModulosProvider>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <AdminSidebar />
          <div className="min-w-0 flex-1 pb-12">
            <GuardModulo>{children}</GuardModulo>
          </div>
        </div>
      </ModulosProvider>
    </RequireRol>
  );
}
