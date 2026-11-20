import { MS_POR_HORA, MS_POR_MINUTO } from '../common/tiempo';
import type { CanalMensajeria } from './conversaciones.tipos';

/**
 * Derivaciones sin respuesta: en noviembre de 2026 hubo clientes que dejaron
 * su pedido completo después de pedir una persona y nadie les contestó. Si
 * pasan 10 minutos sin que el equipo escriba, se le vuelve a avisar una vez.
 */
export const MINUTOS_SIN_RESPUESTA = 10;
// Una derivación de hace horas ya no es urgente: no se re-avisa.
const HORAS_MAX_REAVISO = 6;

export const MOTIVO_REAVISO = `Nadie le ha respondido en ${MINUTOS_SIN_RESPUESTA} minutos desde que pidió una persona: escríbele por favor`;

export interface CandidataReaviso {
  id: string;
  canal: CanalMensajeria;
  identificador_externo: string;
  telefono: string | null;
  derivado_en: string;
}

/** Rango de `derivado_en` de las derivaciones a las que ya toca re-avisar. */
export function ventanaReaviso(ahora: Date): { desde: string; hasta: string } {
  return {
    desde: new Date(
      ahora.getTime() - HORAS_MAX_REAVISO * MS_POR_HORA,
    ).toISOString(),
    hasta: new Date(
      ahora.getTime() - MINUTOS_SIN_RESPUESTA * MS_POR_MINUTO,
    ).toISOString(),
  };
}
