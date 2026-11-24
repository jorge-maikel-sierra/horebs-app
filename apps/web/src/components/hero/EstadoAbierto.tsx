'use client';

import { NEGOCIO } from '@/lib/negocio';
import { useEstadoLocal, type EstadoLocal } from '@/lib/estado-local';

const TEXTOS: Record<EstadoLocal, string> = {
  abierto: 'Abierto ahora · pide hasta las 11:00 pm',
  antes: 'Hoy abrimos a las 4:00 pm',
  despues: 'Cerrado · mañana abrimos a las 4:00 pm',
};

/**
 * Chip con el estado del local según la hora de Colombia. En el servidor
 * muestra el horario fijo: la hora del visitante solo se conoce en el
 * navegador y así no hay desajuste de hidratación.
 */
export default function EstadoAbierto() {
  const estado = useEstadoLocal();
  const abierto = estado === 'abierto';

  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium sm:px-3.5 sm:text-sm text-zinc-100 backdrop-blur-sm">
      <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
        {abierto && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-70" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${abierto ? 'bg-success-400' : 'bg-brand-yellow'}`}
        />
      </span>
      {estado ? TEXTOS[estado] : NEGOCIO.horario}
    </p>
  );
}
