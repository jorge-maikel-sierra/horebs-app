import { Suspense } from 'react';
import RequireRol from '@/components/RequireRol';
import AnunciosVista from '@/components/anuncios/AnunciosVista';
import SkeletonInforme from '@/components/informes/SkeletonInforme';

export default function AnunciosPage() {
  return (
    <RequireRol roles={['admin']}>
      {/* useSearchParams necesita un límite de Suspense para el prerender. */}
      <Suspense fallback={<SkeletonInforme />}>
        <AnunciosVista />
      </Suspense>
    </RequireRol>
  );
}
