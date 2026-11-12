/**
 * Comentarios en posts y anuncios (Facebook e Instagram). Quien comenta
 * "precio", "info" o "menú" está pidiendo que le escriban: se le manda UNA
 * respuesta privada por chat (Meta solo permite una, hasta 7 días después
 * del comentario) y desde ahí sigue el bot normal.
 */

export interface CambioWebhook {
  field?: string;
  value?: Record<string, unknown>;
}

export interface EntradaConCambios {
  id?: string;
  changes?: CambioWebhook[];
}

export interface ComentarioEntrante {
  canal: 'messenger' | 'instagram';
  comentarioId: string;
  texto: string;
}

export const TEXTO_RESPUESTA_COMENTARIO =
  '¡Hola! 🍕 Gracias por tu comentario. Por aquí te atiendo al instante: escríbeme "menú" para ver precios y fotos, o cuéntame qué pizza quieres y te ayudo con el pedido.';

const PIDE_INFORMACION =
  /\b(precio|precios|cuanto|cuesta|vale|valor|menu|carta|info|informacion|pedido|pedir|domicilio|domicilios|interesad[oa]|disponible|whatsapp|numero|ordenar|encargar)\b/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** ¿El comentario está pidiendo información o quiere comprar? */
export function pideInformacion(texto: string): boolean {
  return PIDE_INFORMACION.test(normalizar(texto));
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function idDe(valor: unknown): string | null {
  if (!valor || typeof valor !== 'object') return null;
  return texto(new Map(Object.entries(valor)).get('id'));
}

/** Facebook: campo `feed`, item `comment`, verbo `add`. */
function comentarioDePagina(
  cambio: CambioWebhook,
  paginaId: string | undefined,
): ComentarioEntrante | null {
  const v = new Map(Object.entries(cambio.value ?? {}));
  if (cambio.field !== 'feed' || v.get('item') !== 'comment') return null;
  if (v.get('verb') !== 'add' || idDe(v.get('from')) === paginaId) return null;
  const comentarioId = texto(v.get('comment_id'));
  const mensaje = texto(v.get('message'));
  return comentarioId && mensaje
    ? { canal: 'messenger', comentarioId, texto: mensaje }
    : null;
}

/** Instagram: campo `comments` (posts, reels y anuncios). */
function comentarioDeInstagram(
  cambio: CambioWebhook,
  cuentaId: string | undefined,
): ComentarioEntrante | null {
  const v = new Map(Object.entries(cambio.value ?? {}));
  if (cambio.field !== 'comments') return null;
  if (idDe(v.get('from')) === cuentaId) return null;
  const comentarioId = texto(v.get('id'));
  const mensaje = texto(v.get('text'));
  return comentarioId && mensaje
    ? { canal: 'instagram', comentarioId, texto: mensaje }
    : null;
}

export function parsearComentarios(
  entradas: EntradaConCambios[] | undefined,
  canal: 'messenger' | 'instagram',
): ComentarioEntrante[] {
  return (entradas ?? []).flatMap((entrada) =>
    (entrada.changes ?? []).flatMap((cambio) => {
      const comentario =
        canal === 'messenger'
          ? comentarioDePagina(cambio, entrada.id)
          : comentarioDeInstagram(cambio, entrada.id);
      return comentario ?? [];
    }),
  );
}
