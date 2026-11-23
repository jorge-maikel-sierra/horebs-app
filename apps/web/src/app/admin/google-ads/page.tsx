import { Suspense } from 'react';
import RequireRol from '@/components/RequireRol';
import GoogleAdsVista from '@/components/google-ads/GoogleAdsVista';
import SkeletonInforme from '@/components/informes/SkeletonInforme';

export default function GoogleAdsPage() {
  return (
    <RequireRol roles={['admin']}>
      {/* useSearchParams necesita un límite de Suspense para el prerender. */}
      <Suspense fallback={<SkeletonInforme />}>
        <GoogleAdsVista />
      </Suspense>
    </RequireRol>
  );
}
