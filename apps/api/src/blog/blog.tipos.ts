export type EstadoBlogPost = 'borrador' | 'publicado';

export interface BlogPostDto {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string | null;
  imagen_url: string | null;
  etiqueta: string | null;
  estado: EstadoBlogPost;
  publicado_en: string | null;
  created_at: string;
}

export interface ComentarioDto {
  id: string;
  usuario_id: string;
  autor_nombre: string;
  contenido: string;
  created_at: string;
}

export interface CrearComentarioInput {
  contenido: string;
}

export interface CrearBlogPostInput {
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave?: string;
  imagen_url?: string;
  etiqueta?: string;
  estado?: EstadoBlogPost;
}

export interface TotalMeGustaDto {
  total: number;
}

export interface MeGustaDto {
  meGusta: boolean;
}

export interface EstadoMeGustaDto extends TotalMeGustaDto, MeGustaDto {}

/** Lo que hace falta del post guardado para decidir si se estrena `publicado_en`. */
export interface FilaPostActual {
  estado: EstadoBlogPost;
  publicado_en: string | null;
}

export interface FilaIdPost {
  id: string;
}

export interface FilaAutorComentario {
  id: string;
  usuario_id: string;
}

export interface FilaPerfilStaff {
  rol: string;
}

export const BLOG_POST_SELECT =
  'id, titulo, slug, resumen, contenido, palabra_clave, imagen_url, etiqueta, estado, publicado_en, created_at';

export const COMENTARIO_SELECT =
  'id, usuario_id, autor_nombre, contenido, created_at';

export const MAX_LARGO_COMENTARIO = 2000;
