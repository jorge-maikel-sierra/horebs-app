import type { CanalMensajeria } from './conversaciones.tipos';

const MAX_BYTES_TEXTO_WHATSAPP = 4096;
const MAX_BYTES_TEXTO_MESSENGER = 2000;
const MAX_BYTES_TEXTO_INSTAGRAM = 1000;

const MAX_QUICK_REPLIES_WHATSAPP = 3;
const MAX_QUICK_REPLIES_SOCIAL = 13;

const MAX_LARGO_TITULO_QUICK_REPLY = 20;

const MAX_ELEMENTOS_TARJETAS_WHATSAPP = 3;
const MAX_ELEMENTOS_TARJETAS_SOCIAL = 10;

const MAX_LARGO_TITULO_TARJETA_WHATSAPP = 60;
const MAX_LARGO_TITULO_TARJETA_SOCIAL = 80;

const MAX_LARGO_SUBTITULO_TARJETA_WHATSAPP = 60;
const MAX_LARGO_SUBTITULO_TARJETA_SOCIAL = 80;

const MAX_BOTONES_TARJETA_WHATSAPP = 1;
const MAX_BOTONES_TARJETA_SOCIAL = 3;

export interface CapacidadesCanal {
  readonly canal: CanalMensajeria;
  readonly maxBytesTexto: number;
  readonly maxQuickReplies: number;
  readonly maxLargoTituloQuickReply: number;
  readonly admiteTelefonoNativo: boolean;
  readonly maxElementosTarjetas: number;
  readonly maxLargoTituloTarjeta: number;
  readonly maxLargoSubtituloTarjeta: number;
  readonly maxBotonesTarjeta: number;
  readonly tipoInicio: 'ninguno' | 'get_started' | 'ice_breakers';
}

export const CAPACIDADES_CANAL: Record<CanalMensajeria, CapacidadesCanal> = {
  whatsapp: {
    canal: 'whatsapp',
    maxBytesTexto: MAX_BYTES_TEXTO_WHATSAPP,
    maxQuickReplies: MAX_QUICK_REPLIES_WHATSAPP,
    maxLargoTituloQuickReply: MAX_LARGO_TITULO_QUICK_REPLY,
    admiteTelefonoNativo: false,
    maxElementosTarjetas: MAX_ELEMENTOS_TARJETAS_WHATSAPP,
    maxLargoTituloTarjeta: MAX_LARGO_TITULO_TARJETA_WHATSAPP,
    maxLargoSubtituloTarjeta: MAX_LARGO_SUBTITULO_TARJETA_WHATSAPP,
    maxBotonesTarjeta: MAX_BOTONES_TARJETA_WHATSAPP,
    tipoInicio: 'ninguno',
  },
  messenger: {
    canal: 'messenger',
    maxBytesTexto: MAX_BYTES_TEXTO_MESSENGER,
    maxQuickReplies: MAX_QUICK_REPLIES_SOCIAL,
    maxLargoTituloQuickReply: MAX_LARGO_TITULO_QUICK_REPLY,
    admiteTelefonoNativo: true,
    maxElementosTarjetas: MAX_ELEMENTOS_TARJETAS_SOCIAL,
    maxLargoTituloTarjeta: MAX_LARGO_TITULO_TARJETA_SOCIAL,
    maxLargoSubtituloTarjeta: MAX_LARGO_SUBTITULO_TARJETA_SOCIAL,
    maxBotonesTarjeta: MAX_BOTONES_TARJETA_SOCIAL,
    tipoInicio: 'get_started',
  },
  instagram: {
    canal: 'instagram',
    maxBytesTexto: MAX_BYTES_TEXTO_INSTAGRAM,
    maxQuickReplies: MAX_QUICK_REPLIES_SOCIAL,
    maxLargoTituloQuickReply: MAX_LARGO_TITULO_QUICK_REPLY,
    admiteTelefonoNativo: false,
    maxElementosTarjetas: MAX_ELEMENTOS_TARJETAS_SOCIAL,
    maxLargoTituloTarjeta: MAX_LARGO_TITULO_TARJETA_SOCIAL,
    maxLargoSubtituloTarjeta: MAX_LARGO_SUBTITULO_TARJETA_SOCIAL,
    maxBotonesTarjeta: MAX_BOTONES_TARJETA_SOCIAL,
    tipoInicio: 'ice_breakers',
  },
};

export function obtenerCapacidades(canal: CanalMensajeria): CapacidadesCanal {
  // eslint-disable-next-line security/detect-object-injection
  return CAPACIDADES_CANAL[canal];
}

/**
 * Parte un texto en bloques sin exceder maxBytes en UTF-8, preservando
 * saltos de línea o palabras cuando es posible y sin cortar caracteres
 * multibyte ni pares sustitutos de Unicode.
 */
export function partirTextoPorBytes(texto: string, maxBytes: number): string[] {
  if (Buffer.byteLength(texto, 'utf8') <= maxBytes) {
    return [texto];
  }
  const partes: string[] = [];
  let parteActual = '';

  const lineas = texto.split('\n');
  for (const linea of lineas) {
    const separador = parteActual.length > 0 ? '\n' : '';
    const candidato = `${parteActual}${separador}${linea}`;

    if (Buffer.byteLength(candidato, 'utf8') <= maxBytes) {
      parteActual = candidato;
    } else {
      if (parteActual.length > 0) {
        partes.push(parteActual);
        parteActual = '';
      }
      parteActual = agregarLinea(linea, maxBytes, partes);
    }
  }
  if (parteActual.length > 0) {
    partes.push(parteActual);
  }
  return partes;
}

function agregarLinea(
  linea: string,
  maxBytes: number,
  partes: string[],
): string {
  if (Buffer.byteLength(linea, 'utf8') <= maxBytes) {
    return linea;
  }
  const subpartes = partirLineaPorBytes(linea, maxBytes);
  for (let j = 0; j < subpartes.length - 1; j++) {
    // eslint-disable-next-line security/detect-object-injection
    partes.push(subpartes[j]);
  }

  return subpartes[subpartes.length - 1] ?? '';
}

function partirLineaPorBytes(linea: string, maxBytes: number): string[] {
  const palabras = linea.split(' ');
  const partes: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const separador = actual.length > 0 ? ' ' : '';
    const candidato = `${actual}${separador}${palabra}`;
    if (Buffer.byteLength(candidato, 'utf8') <= maxBytes) {
      actual = candidato;
    } else {
      if (actual.length > 0) {
        partes.push(actual);
        actual = '';
      }
      actual = procesarPalabraLarga(palabra, maxBytes, partes);
    }
  }
  if (actual.length > 0) {
    partes.push(actual);
  }
  return partes;
}

function procesarPalabraLarga(
  palabra: string,
  maxBytes: number,
  partes: string[],
): string {
  if (Buffer.byteLength(palabra, 'utf8') <= maxBytes) {
    return palabra;
  }
  const porCaracteres = partirPorCodePoints(palabra, maxBytes);
  for (let k = 0; k < porCaracteres.length - 1; k++) {
    // eslint-disable-next-line security/detect-object-injection
    partes.push(porCaracteres[k]);
  }

  return porCaracteres[porCaracteres.length - 1] ?? '';
}

function partirPorCodePoints(palabra: string, maxBytes: number): string[] {
  const codePoints = Array.from(palabra);
  const partes: string[] = [];
  let trozo = '';
  for (const cp of codePoints) {
    if (Buffer.byteLength(trozo + cp, 'utf8') > maxBytes) {
      if (trozo.length > 0) partes.push(trozo);
      trozo = cp;
    } else {
      trozo += cp;
    }
  }
  if (trozo.length > 0) partes.push(trozo);
  return partes;
}
