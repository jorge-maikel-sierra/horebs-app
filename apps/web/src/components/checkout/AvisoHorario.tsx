'use client';

import { useEstadoLocal } from '@/lib/estado-local';
import { NEGOCIO } from '@/lib/negocio';

/**
 * Aviso antes de pedir si el local está cerrado. No bloquea el pedido
 * (puede dejarlo listo), pero lo dice antes de confirmar y no después.
 */
export default function AvisoHorario() {
  const estado = useEstadoLocal();
  if (estado === null || estado === 'abierto') return null;
  const cuando = estado === 'antes' ? 'Hoy abrimos a las 4:00 pm' : 'Ya cerramos por hoy; abrimos mañana a las 4:00 pm';
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-brand-yellow-300 bg-brand-yellow-50 px-3.5 py-3 text-sm text-zinc-800 dark:border-brand-yellow-700/50 dark:bg-brand-yellow-900/20 dark:text-zinc-200"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-brand-yellow-800 dark:text-brand-yellow-400">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <p>
        <strong className="font-semibold">{cuando}.</strong> Atendemos {NEGOCIO.horario.toLowerCase()}: tu pedido se
        prepara cuando abramos.
      </p>
    </div>
  );
}
