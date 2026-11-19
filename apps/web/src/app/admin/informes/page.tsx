'use client';

import { Suspense } from 'react';
import RequireRol from '@/components/RequireRol';
import InformesVista from '@/components/informes/InformesVista';
import SkeletonInforme from '@/components/informes/SkeletonInforme';

export default function InformesPage() {
  return (
    <RequireRol roles={['admin']}>
      {/* InformesVista lee la URL con useSearchParams: sin este límite el
          build falla al prerenderizar la página. */}
      <Suspense fallback={<SkeletonInforme />}>
        <InformesVista />
      </Suspense>
    </RequireRol>
  );
}
