import { Esquema, enumerado, opcional, texto } from '../common/validacion';
import { MAX_LARGO_COMENTARIO } from './blog.tipos';

export const ESQUEMA_COMENTARIO: Esquema = {
  contenido: texto({ max: MAX_LARGO_COMENTARIO }),
};

const MAX_TITULO = 200;
const MAX_SLUG = 200;
const MAX_RESUMEN = 500;
const MAX_CONTENIDO = 200_000;
const MAX_PALABRA_CLAVE = 200;
const MAX_IMAGEN_URL = 1000;
const MAX_ETIQUETA = 100;
const ESTADOS_POST = ['borrador', 'publicado'];

/** `POST /admin/blog`: lo obligatorio es título, slug, resumen y contenido. */
export const ESQUEMA_CREAR_POST: Esquema = {
  titulo: texto({ max: MAX_TITULO }),
  slug: texto({ max: MAX_SLUG }),
  resumen: texto({ max: MAX_RESUMEN }),
  contenido: texto({ max: MAX_CONTENIDO }),
  // Cadena vacía borra el dato (el service la vuelve null).
  palabra_clave: opcional(texto({ min: 0, max: MAX_PALABRA_CLAVE })),
  imagen_url: opcional(texto({ min: 0, max: MAX_IMAGEN_URL })),
  etiqueta: opcional(texto({ min: 0, max: MAX_ETIQUETA })),
  estado: opcional(enumerado(ESTADOS_POST)),
};

/** `PATCH /admin/blog/:id`: todo es opcional, pero lo obligatorio no se puede vaciar. */
export const ESQUEMA_EDITAR_POST: Esquema = {
  titulo: opcional(texto({ max: MAX_TITULO })),
  slug: opcional(texto({ max: MAX_SLUG })),
  resumen: opcional(texto({ max: MAX_RESUMEN })),
  contenido: opcional(texto({ max: MAX_CONTENIDO })),
  palabra_clave: opcional(texto({ min: 0, max: MAX_PALABRA_CLAVE })),
  imagen_url: opcional(texto({ min: 0, max: MAX_IMAGEN_URL })),
  etiqueta: opcional(texto({ min: 0, max: MAX_ETIQUETA })),
  estado: opcional(enumerado(ESTADOS_POST)),
};
