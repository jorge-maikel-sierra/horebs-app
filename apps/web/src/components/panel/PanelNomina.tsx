import CargandoSkeleton from '@/components/CargandoSkeleton';
import { formatPrecio } from '@/lib/formato';
import { IconCheck } from './iconos';
import SeccionPanel from './SeccionPanel';

export type FilaTableroNomina = {
  empleado: { nombre: string };
  semana: { neto_pagar: number; estado: 'en_curso' | 'liquidada' };
};

/** Lo que falta por pagar de la semana y cuántas semanas ya se liquidaron. */
export default function PanelNomina({
  cargando,
  fallo,
  filas,
}: {
  cargando: boolean;
  fallo: boolean;
  filas: FilaTableroNomina[] | null;
}) {
  const enCurso = filas?.filter((f) => f.semana.estado === 'en_curso') ?? [];
  const pendiente = enCurso.reduce((s, f) => s + f.semana.neto_pagar, 0);
  const liquidadas =
    filas?.filter((f) => f.semana.estado === 'liquidada').length ?? 0;

  return (
    <SeccionPanel
      titulo="Nómina de la semana"
      enlace={{ href: '/admin/nomina', texto: 'Ver nómina' }}
    >
      {cargando ? (
        <CargandoSkeleton filas={1} />
      ) : fallo ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar la nómina.
        </p>
      ) : !filas || filas.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No hay trabajadores activos registrados.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
            <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Por pagar
            </p>
            <p className="mt-1 [overflow-wrap:anywhere] text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatPrecio(pendiente)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {enCurso.length} en curso
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              <IconCheck /> Liquidadas
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {liquidadas}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              esta semana
            </p>
          </div>
        </div>
      )}
    </SeccionPanel>
  );
}
