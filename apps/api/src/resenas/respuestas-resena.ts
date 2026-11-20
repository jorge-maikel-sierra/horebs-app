import { TELEFONO_NEGOCIO } from '../common/contacto';
import { MS_POR_DIA } from '../common/tiempo';
import type { NuevaResena, ResenaGoogle } from './resenas.tipos';

/** Desde 4★ se publica sola; de 1 a 3★ la aprueba una persona del equipo (decisión del dueño, 20 nov 2026). */
export const ESTRELLAS_MINIMAS_AUTOMATICA = 4;

/** Una reseña más vieja no se contesta sola: queda de borrador (evita responder años de historial de golpe). */
const DIAS_MAXIMOS_AUTOMATICA = 7;

// En orden: la posición + 1 son las estrellas.
const CALIFICACIONES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
const MULTIPLICADOR_HASH = 31;

const NOMBRES_ANONIMOS = /usuario de google|google user/i;
const MARCA_TRADUCCION = '(Translated by Google)';
const MARCA_ORIGINAL = '(Original)';

type Plantilla = (saludo: string) => string;

const SIN_COMENTARIO: readonly Plantilla[] = [
  (s) =>
    `¡Muchas gracias${s}! Nos alegra que hayas disfrutado Pizzería Horebs. Te esperamos pronto 🍕`,
  (s) =>
    `¡Gracias por tu calificación${s}! Es un gusto atenderte. Aquí te esperamos para la próxima pizza 🍕`,
  (s) =>
    `¡Qué alegría${s}! Gracias por elegirnos. Nos vemos pronto en Pizzería Horebs 🍕`,
];

const CON_COMENTARIO: readonly Plantilla[] = [
  (s) =>
    `¡Muchas gracias por tus palabras${s}! Comentarios así nos animan a seguir dando lo mejor en cada pizza. Te esperamos pronto 🍕`,
  (s) =>
    `¡Gracias${s} por tomarte el tiempo de escribirnos! Nos alegra mucho que hayas tenido una buena experiencia. Aquí te esperamos 🍕`,
  (s) =>
    `¡Qué bueno leer esto${s}! Gracias por confiar en Pizzería Horebs. Te esperamos para la próxima 🍕`,
];

const NEGATIVA: Plantilla = (s) =>
  `Hola${s}, gracias por contarnos tu experiencia y lamentamos que no haya sido la que esperabas. Queremos saber qué pasó para mejorarlo: escríbenos al WhatsApp ${TELEFONO_NEGOCIO} y lo revisamos contigo.`;

export function estrellasDe(calificacion: string | undefined): number | null {
  const posicion = CALIFICACIONES.indexOf(calificacion ?? '');
  return posicion >= 0 ? posicion + 1 : null;
}

/** Solo el primer nombre, y nada si la reseña es anónima. */
export function primerNombre(autor: string | null): string | null {
  if (!autor || NOMBRES_ANONIMOS.test(autor)) return null;
  const palabra = autor.trim().split(/\s+/)[0] ?? '';
  if (!/^\p{L}{2,}$/u.test(palabra)) return null;
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

/** Google agrega su traducción al comentario; se guarda solo lo que escribió el cliente. */
export function comentarioOriginal(comentario?: string): string | null {
  const texto = comentario?.trim() ?? '';
  if (!texto) return null;
  const original = texto.indexOf(MARCA_ORIGINAL);
  if (texto.startsWith(MARCA_TRADUCCION) && original >= 0) {
    return texto.slice(original + MARCA_ORIGINAL.length).trim() || null;
  }
  const traduccion = texto.indexOf(MARCA_TRADUCCION);
  return (traduccion > 0 ? texto.slice(0, traduccion) : texto).trim() || null;
}

/** Siempre la misma plantilla para la misma reseña, distinta entre reseñas. */
function elegir<T>(opciones: readonly T[], semilla: string): T {
  let hash = 0;
  for (const c of semilla)
    hash = (hash * MULTIPLICADOR_HASH + c.charCodeAt(0)) >>> 0;
  return opciones.at(hash % opciones.length) as T;
}

export function armarRespuesta(datos: {
  googleId: string;
  autor: string | null;
  estrellas: number;
  comentario: string | null;
}): string {
  const nombre = primerNombre(datos.autor);
  const saludo = nombre ? `, ${nombre}` : '';
  if (datos.estrellas < ESTRELLAS_MINIMAS_AUTOMATICA) return NEGATIVA(saludo);
  const plantillas = datos.comentario ? CON_COMENTARIO : SIN_COMENTARIO;
  return elegir(plantillas, datos.googleId)(saludo);
}

function autorDe(resena: ResenaGoogle): string | null {
  if (resena.reviewer?.isAnonymous) return null;
  return resena.reviewer?.displayName?.trim() || null;
}

function esReciente(resena: ResenaGoogle, ahora: Date): boolean {
  const edad = ahora.getTime() - new Date(resena.createTime).getTime();
  return edad <= DIAS_MAXIMOS_AUTOMATICA * MS_POR_DIA;
}

export interface ResenaClasificada {
  fila: NuevaResena;
  /** Publicar ya la respuesta en Google. */
  publicar: boolean;
  /** Avisar al equipo para que la apruebe. */
  avisar: boolean;
}

/**
 * Decide qué hacer con una reseña que el API todavía no conocía. Ya
 * contestada en Google → se guarda tal cual. 1–3★ → borrador para el
 * equipo. 4–5★ reciente → se publica sola si está activado; si no, o si
 * es vieja, queda de borrador sin aviso.
 */
export function clasificarResena(
  resena: ResenaGoogle,
  ahora: Date,
  publicarAutomatico: boolean,
): ResenaClasificada | null {
  const estrellas = estrellasDe(resena.starRating);
  if (estrellas === null) return null;
  const autor = autorDe(resena);
  const comentario = comentarioOriginal(resena.comment);
  const base = {
    google_id: resena.name,
    autor,
    estrellas,
    comentario,
    creada_en: resena.createTime,
  };
  if (resena.reviewReply) {
    return {
      fila: {
        ...base,
        estado: 'respondida',
        respuesta: resena.reviewReply.comment,
        respondida_en: resena.reviewReply.updateTime ?? null,
      },
      publicar: false,
      avisar: false,
    };
  }
  const respuesta = armarRespuesta({
    googleId: resena.name,
    autor,
    estrellas,
    comentario,
  });
  const fila = { ...base, respuesta, respondida_en: null };
  if (estrellas < ESTRELLAS_MINIMAS_AUTOMATICA) {
    return {
      fila: { ...fila, estado: 'para_revisar' },
      publicar: false,
      avisar: true,
    };
  }
  const publicar = publicarAutomatico && esReciente(resena, ahora);
  return { fila: { ...fila, estado: 'pendiente' }, publicar, avisar: false };
}
