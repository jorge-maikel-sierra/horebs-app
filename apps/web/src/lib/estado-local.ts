'use client';

import { useSyncExternalStore } from 'react';
import { NEGOCIO } from '@/lib/negocio';

export type EstadoLocal = 'abierto' | 'antes' | 'despues';

const UN_MINUTO_MS = 60_000;

function horaEnColombia(): number {
  const hora = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date());
  return Number(hora);
}

function leerEstado(): EstadoLocal {
  const hora = horaEnColombia();
  if (hora < NEGOCIO.horaApertura) return 'antes';
  if (hora >= NEGOCIO.horaCierre) return 'despues';
  return 'abierto';
}

function suscribir(avisar: () => void) {
  const intervalo = window.setInterval(avisar, UN_MINUTO_MS);
  return () => window.clearInterval(intervalo);
}

/**
 * Si el local está abierto ahora, según la hora de Colombia. `null` en el
 * servidor: la hora del visitante solo se conoce en el navegador y así no
 * hay desajuste de hidratación. Se revisa cada minuto.
 */
export function useEstadoLocal(): EstadoLocal | null {
  return useSyncExternalStore<EstadoLocal | null>(suscribir, leerEstado, () => null);
}
