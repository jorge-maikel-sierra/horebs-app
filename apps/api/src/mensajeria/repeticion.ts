import { MS_POR_SEGUNDO } from '../common/tiempo';

/**
 * El mismo mensaje del mismo cliente dos veces en pocos segundos (tocó dos
 * veces el rompehielos del anuncio, como pasó en producción en nov 2026) se
 * contesta una sola vez.
 */
export const SEGUNDOS_REPETICION = 10;
const MAX_CONVERSACIONES_RECORDADAS = 1000;

export interface UltimoMensaje {
  contenido: string;
  en: number;
}

export function esRepeticion(
  ultimos: Map<string, UltimoMensaje>,
  conversacion: string,
  contenido: string,
  ahora: number,
): boolean {
  const limpio = contenido.trim().toLowerCase();
  if (!limpio) return false;
  const previo = ultimos.get(conversacion);
  const repetido =
    previo !== undefined &&
    previo.contenido === limpio &&
    ahora - previo.en < SEGUNDOS_REPETICION * MS_POR_SEGUNDO;
  if (ultimos.size >= MAX_CONVERSACIONES_RECORDADAS) ultimos.clear();
  ultimos.set(conversacion, { contenido: limpio, en: ahora });
  return repetido;
}
