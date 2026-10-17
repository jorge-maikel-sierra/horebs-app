'use client';

import { useSyncExternalStore } from 'react';
import { NEGOCIO } from '@/lib/negocio';

type Estado = 'abierto' | 'antes' | 'despues';

function horaEnColombia(): number {
  const hora = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date());
  return Number(hora);
}

function leerEstado(): Estado {
  const hora = horaEnColombia();
  if (hora < NEGOCIO.horaApertura) return 'antes';
  if (hora >= NEGOCIO.horaCierre) return 'despues';
  return 'abierto';
}

function suscribir(avisar: () => void) {
  const intervalo = window.setInterval(avisar, 60_000);
  return () => window.clearInterval(intervalo);
}

const TEXTOS: Record<Estado, string> = {
  abierto: 'Abierto ahora · pedí hasta las 11:00 pm',
  antes: 'Hoy abrimos a las 4:00 pm',
  despues: 'Cerrado · mañana abrimos a las 4:00 pm',
};

/**
 * Chip con el estado del local según la hora de Colombia. En el servidor
 * muestra el horario fijo: la hora del visitante solo se conoce en el
 * navegador y así no hay desajuste de hidratación.
 */
export default function EstadoAbierto() {
  const estado = useSyncExternalStore<Estado | null>(
    suscribir,
    leerEstado,
    () => null,
  );
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
