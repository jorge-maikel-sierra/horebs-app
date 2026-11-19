import RequireRol from '@/components/RequireRol';
import CampanasVista from '@/components/campanas/CampanasVista';

export default function CampanasPage() {
  return (
    <RequireRol roles={['admin']}>
      <CampanasVista />
    </RequireRol>
  );
}
