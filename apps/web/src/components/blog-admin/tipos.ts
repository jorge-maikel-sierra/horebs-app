export type Estado = 'borrador' | 'publicado';

export type BlogPost = {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string | null;
  imagen_url: string | null;
  etiqueta: string | null;
  estado: Estado;
  publicado_en: string | null;
  created_at: string;
};

export type FormBlog = {
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string;
  imagen_url: string;
  etiqueta: string;
  estado: Estado;
};

export const VACIO: FormBlog = {
  titulo: '',
  slug: '',
  resumen: '',
  contenido: '',
  palabra_clave: '',
  imagen_url: '',
  etiqueta: '',
  estado: 'borrador',
};

export const ETIQUETAS_SUGERIDAS = ['Guías', 'Menú', 'Domicilio'];

// Longitudes recomendadas para que Google no recorte título y descripción.
export const LIMITE_TITULO = 60;
export const LIMITE_RESUMEN = 160;

export function desdePost(post: BlogPost): FormBlog {
  return {
    titulo: post.titulo,
    slug: post.slug,
    resumen: post.resumen,
    contenido: post.contenido,
    palabra_clave: post.palabra_clave ?? '',
    imagen_url: post.imagen_url ?? '',
    etiqueta: post.etiqueta ?? '',
    estado: post.estado,
  };
}

export function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(texto: string) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function contarPalabras(texto: string) {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

export function minutosLectura(texto: string) {
  const palabras = contarPalabras(texto);
  return palabras === 0 ? 0 : Math.max(1, Math.ceil(palabras / 200));
}

export function esUrlHttp(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Las fechas del negocio se muestran siempre en hora de Bogotá.
const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

export function formatFecha(iso: string) {
  return FECHA.format(new Date(iso)).replace(/\./g, '');
}
