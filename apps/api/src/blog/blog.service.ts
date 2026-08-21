import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface BlogPostDto {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  palabra_clave: string | null;
  imagen_url: string | null;
  estado: 'borrador' | 'publicado';
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
  estado?: 'borrador' | 'publicado';
}

const BLOG_POST_SELECT =
  'id, titulo, slug, resumen, contenido, palabra_clave, imagen_url, estado, publicado_en, created_at';

const COMENTARIO_SELECT = 'id, usuario_id, autor_nombre, contenido, created_at';

const MAX_LARGO_COMENTARIO = 2000;

@Injectable()
export class BlogService {
  constructor(private readonly supabase: SupabaseService) {}

  async getPostsPublicados(): Promise<BlogPostDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .eq('estado', 'publicado')
      .order('publicado_en', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getPostPublicadoPorSlug(slug: string): Promise<BlogPostDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  private async getPostIdPublicado(slug: string): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Artículo no encontrado.');
    return data.id;
  }

  async getComentarios(slug: string): Promise<ComentarioDto[]> {
    const postId = await this.getPostIdPublicado(slug);
    const { data, error } = await this.supabase
      .getClient()
      .from('comentarios_blog')
      .select(COMENTARIO_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async crearComentario(
    slug: string,
    usuarioId: string,
    autorNombre: string,
    input: CrearComentarioInput,
  ): Promise<ComentarioDto> {
    const contenido = input.contenido?.trim();
    if (!contenido) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }
    if (contenido.length > MAX_LARGO_COMENTARIO) {
      throw new BadRequestException(
        `El comentario es demasiado largo (máximo ${MAX_LARGO_COMENTARIO} caracteres).`,
      );
    }

    const postId = await this.getPostIdPublicado(slug);
    const { data, error } = await this.supabase
      .getClient()
      .from('comentarios_blog')
      .insert({
        post_id: postId,
        usuario_id: usuarioId,
        autor_nombre: autorNombre || 'Cliente',
        contenido,
      })
      .select(COMENTARIO_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async eliminarComentario(
    comentarioId: string,
    usuarioId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { data: comentario, error: buscarError } = await client
      .from('comentarios_blog')
      .select('id, usuario_id')
      .eq('id', comentarioId)
      .maybeSingle();

    if (buscarError) throw buscarError;
    if (!comentario) throw new NotFoundException('Comentario no encontrado.');

    if (comentario.usuario_id !== usuarioId) {
      const { data: perfil } = await client
        .from('perfiles_staff')
        .select('rol')
        .eq('id', usuarioId)
        .maybeSingle();

      if (!perfil || perfil.rol !== 'admin') {
        throw new ForbiddenException(
          'No podés borrar el comentario de otra persona.',
        );
      }
    }

    const { error } = await client
      .from('comentarios_blog')
      .delete()
      .eq('id', comentarioId);
    if (error) throw error;
  }

  async getLikesTotal(slug: string): Promise<{ total: number }> {
    const postId = await this.getPostIdPublicado(slug);
    const { count, error } = await this.supabase
      .getClient()
      .from('likes_blog_post')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) throw error;
    return { total: count ?? 0 };
  }

  async getMeGusta(
    slug: string,
    usuarioId: string,
  ): Promise<{ meGusta: boolean }> {
    const postId = await this.getPostIdPublicado(slug);
    const { data, error } = await this.supabase
      .getClient()
      .from('likes_blog_post')
      .select('id')
      .eq('post_id', postId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) throw error;
    return { meGusta: !!data };
  }

  async toggleLike(
    slug: string,
    usuarioId: string,
  ): Promise<{ total: number; meGusta: boolean }> {
    const postId = await this.getPostIdPublicado(slug);
    const client = this.supabase.getClient();

    const { data: existente, error: buscarError } = await client
      .from('likes_blog_post')
      .select('id')
      .eq('post_id', postId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (buscarError) throw buscarError;

    if (existente) {
      const { error } = await client
        .from('likes_blog_post')
        .delete()
        .eq('id', existente.id);
      if (error) throw error;
    } else {
      const { error } = await client
        .from('likes_blog_post')
        .insert({ post_id: postId, usuario_id: usuarioId });
      if (error) throw error;
    }

    const { total } = await this.getLikesTotal(slug);
    return { total, meGusta: !existente };
  }

  /** A diferencia de `getPostsPublicados`, incluye borradores — uso admin. */
  async listarBlogPosts(): Promise<BlogPostDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async crearBlogPost(input: CrearBlogPostInput): Promise<BlogPostDto> {
    if (!input.titulo?.trim()) {
      throw new BadRequestException('El título es obligatorio.');
    }
    if (!input.slug?.trim()) {
      throw new BadRequestException('El slug es obligatorio.');
    }
    if (!input.resumen?.trim()) {
      throw new BadRequestException('El resumen es obligatorio.');
    }
    if (!input.contenido?.trim()) {
      throw new BadRequestException('El contenido es obligatorio.');
    }

    const estado = input.estado ?? 'borrador';
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .insert({
        titulo: input.titulo.trim(),
        slug: input.slug.trim(),
        resumen: input.resumen.trim(),
        contenido: input.contenido,
        palabra_clave: input.palabra_clave?.trim() || null,
        imagen_url: input.imagen_url?.trim() || null,
        estado,
        publicado_en: estado === 'publicado' ? new Date().toISOString() : null,
      })
      .select(BLOG_POST_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async actualizarBlogPost(
    id: string,
    input: Partial<CrearBlogPostInput>,
  ): Promise<BlogPostDto> {
    const client = this.supabase.getClient();
    const { data: actual, error: errorActual } = await client
      .from('blog_posts')
      .select('estado, publicado_en')
      .eq('id', id)
      .maybeSingle();
    if (errorActual) throw errorActual;
    if (!actual) throw new NotFoundException('Artículo no encontrado.');

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.titulo !== undefined) payload.titulo = input.titulo.trim();
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.resumen !== undefined) payload.resumen = input.resumen.trim();
    if (input.contenido !== undefined) payload.contenido = input.contenido;
    if (input.palabra_clave !== undefined) {
      payload.palabra_clave = input.palabra_clave?.trim() || null;
    }
    if (input.imagen_url !== undefined) {
      payload.imagen_url = input.imagen_url?.trim() || null;
    }
    if (input.estado !== undefined) {
      payload.estado = input.estado;
      if (input.estado === 'publicado' && !actual.publicado_en) {
        payload.publicado_en = new Date().toISOString();
      }
    }

    const { data, error } = await client
      .from('blog_posts')
      .update(payload)
      .eq('id', id)
      .select(BLOG_POST_SELECT)
      .single();

    if (error) throw error;
    return data;
  }

  async eliminarBlogPost(id: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('blog_posts')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Artículo no encontrado.');
  }
}
