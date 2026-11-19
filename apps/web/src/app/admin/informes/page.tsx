'use client';

import RequireRol from '@/components/RequireRol';
import InformesVista from '@/components/informes/InformesVista';

export default function InformesPage() {
  return (
    <RequireRol roles={['admin']}>
      <InformesVista />
    </RequireRol>
  );
}
