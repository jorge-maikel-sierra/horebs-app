import CargandoSkeleton from '@/components/CargandoSkeleton';
import CajaTurno, { type MontosCaja } from './CajaTurno';
import SeccionPanel from './SeccionPanel';

/** Reparto de lo cobrado en el turno abierto, por método de pago. */
export default function PanelCaja({
  cargando,
  fallo,
  abierto,
  montos,
}: {
  cargando: boolean;
  fallo: boolean;
  abierto: boolean;
  montos: MontosCaja;
}) {
  return (
    <SeccionPanel
      titulo="Caja del turno"
      subtitulo="Reparto por método de pago"
      enlace={{ href: '/admin/pos', texto: 'Punto de venta' }}
    >
      {cargando ? (
        <CargandoSkeleton filas={2} />
      ) : fallo ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar el turno.
        </p>
      ) : !abierto ? (
        <p className="rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
          No hay un turno abierto. Al abrirlo desde el punto de venta verás aquí
          cómo se reparte lo cobrado.
        </p>
      ) : (
        <CajaTurno montos={montos} />
      )}
    </SeccionPanel>
  );
}
