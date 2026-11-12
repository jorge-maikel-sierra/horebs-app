import type { ProcedenciaAnuncio } from './parseo-webhook';

// El `ref` de un m.me admite hasta 2083 caracteres; para medir basta mucho menos.
const MAX_LARGO_CAMPO = 500;

/** De dónde llegó el cliente: un anuncio o un enlace con `ref`. */
export interface OrigenContacto {
  fuente: string;
  anuncioId: string | null;
  ref: string | null;
  titulo: string | null;
}

export interface FilaOrigenConversacion {
  origen_fuente: string | null;
  origen_anuncio_id: string | null;
  origen_ref: string | null;
  ultimo_origen_fuente: string | null;
  ultimo_anuncio_id: string | null;
  ultimo_ref: string | null;
}

export const COLUMNAS_ORIGEN =
  'origen_fuente, origen_anuncio_id, origen_ref, ultimo_origen_fuente, ultimo_anuncio_id, ultimo_ref';

function recortar(valor: string | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio.slice(0, MAX_LARGO_CAMPO) : null;
}

/**
 * Traduce el `referral` de Meta a un origen guardable. En WhatsApp el
 * `anuncioId` puede venir relleno con el `ctwa_clid` (no es un id de anuncio):
 * en ese caso se descarta. Sin anuncio ni `ref` no hay nada que medir.
 */
export function origenDeProcedencia(
  procedencia: ProcedenciaAnuncio | null,
): OrigenContacto | null {
  if (!procedencia) return null;
  const anuncioId =
    procedencia.anuncioId !== procedencia.ctwaClid
      ? recortar(procedencia.anuncioId)
      : null;
  const ref = recortar(procedencia.ref);
  if (!anuncioId && !ref && !procedencia.esAnuncio) return null;
  return {
    fuente:
      recortar(procedencia.fuente) ??
      (procedencia.esAnuncio ? 'ADS' : 'desconocida'),
    anuncioId,
    ref,
    titulo: recortar(procedencia.tituloAnuncio),
  };
}

/** Primer toque: se escribe solo si la conversación todavía no tiene origen. */
export function payloadPrimerOrigen(
  origen: OrigenContacto,
  ahora: string,
): Record<string, unknown> {
  return {
    origen_fuente: origen.fuente,
    origen_anuncio_id: origen.anuncioId,
    origen_ref: origen.ref,
    origen_titulo: origen.titulo,
    origen_capturado_en: ahora,
  };
}

/** Último toque: se pisa con cada referral nuevo. */
export function payloadUltimoOrigen(
  origen: OrigenContacto,
  ahora: string,
): Record<string, unknown> {
  return {
    ultimo_origen_fuente: origen.fuente,
    ultimo_anuncio_id: origen.anuncioId,
    ultimo_ref: origen.ref,
    ultimo_origen_en: ahora,
  };
}

/**
 * Lo que se copia al pedido: el último toque (como la atribución por último
 * clic de Meta) y, si no lo hay, el primero. Null si la conversación no
 * tiene origen.
 */
export function payloadOrigenPedido(
  fila: FilaOrigenConversacion | null,
): Record<string, unknown> | null {
  if (!fila) return null;
  if (fila.ultimo_origen_fuente) {
    return {
      origen_fuente: fila.ultimo_origen_fuente,
      origen_anuncio_id: fila.ultimo_anuncio_id,
      origen_ref: fila.ultimo_ref,
    };
  }
  if (fila.origen_fuente) {
    return {
      origen_fuente: fila.origen_fuente,
      origen_anuncio_id: fila.origen_anuncio_id,
      origen_ref: fila.origen_ref,
    };
  }
  return null;
}
