import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import {
  cambiosDePost,
  comentarioValido,
  esAdmin,
  filaNuevoPost,
  nombreDeAutor,
  validarNuevoPost,
} from './blog-reglas';
import {
  BLOG_POST_SELECT,
  COMENTARIO_SELECT,
  type BlogPostDto,
  type ComentarioDto,
  type CrearBlogPostInput,
  type CrearComentarioInput,
  type EstadoMeGustaDto,
  type FilaAutorComentario,
  type FilaIdPost,
  type FilaPerfilStaff,
  type FilaPostActual,
  type MeGustaDto,
  type TotalMeGustaDto,
} from './blog.tipos';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class BlogService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerPostsPublicados(): Promise<BlogPostDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .eq('estado', 'publicado')
      .order('publicado_en', { ascending: false })
      .returns<BlogPostDto[]>();

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async obtenerPostPublicadoPorSlug(slug: string): Promise<BlogPostDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .maybeSingle<BlogPostDto>();

    if (error) throw errorDeBase(error);
    return data ?? null;
  }

  async obtenerComentarios(slug: string): Promise<ComentarioDto[]> {
    const postId = await this.obtenerIdPostPublicado(slug);
    const { data, error } = await this.supabase
      .getClient()
      .from('comentarios_blog')
      .select(COMENTARIO_SELECT)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .returns<ComentarioDto[]>();

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async crearComentario(
    slug: string,
    usuario: UsuarioSupabase,
    input: CrearComentarioInput,
  ): Promise<ComentarioDto> {
    const contenido = comentarioValido(input.contenido);

    const postId = await this.obtenerIdPostPublicado(slug);
    const { data, error } = await this.supabase
      .getClient()
      .from('comentarios_blog')
      .insert({
        post_id: postId,
        usuario_id: usuario.id,
        autor_nombre: nombreDeAutor(usuario) || 'Cliente',
        contenido,
      })
      .select(COMENTARIO_SELECT)
      .single<ComentarioDto>();

    if (error) throw errorDeBase(error);
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
      .maybeSingle<FilaAutorComentario>();

    if (buscarError) throw errorDeBase(buscarError);
    if (!comentario) throw new NotFoundException('Comentario no encontrado.');

    if (comentario.usuario_id !== usuarioId) {
      const { data: perfil } = await client
        .from('perfiles_staff')
        .select('rol')
        .eq('id', usuarioId)
        .maybeSingle<FilaPerfilStaff>();

      if (!esAdmin(perfil)) {
        throw new ForbiddenException(
          'No podés borrar el comentario de otra persona.',
        );
      }
    }

    const { error } = await client
      .from('comentarios_blog')
      .delete()
      .eq('id', comentarioId);
    if (error) throw errorDeBase(error);
  }

  async obtenerTotalMeGusta(slug: string): Promise<TotalMeGustaDto> {
    const postId = await this.obtenerIdPostPublicado(slug);
    return { total: await this.contarMeGusta(postId) };
  }

  async obtenerMeGusta(slug: string, usuarioId: string): Promise<MeGustaDto> {
    const postId = await this.obtenerIdPostPublicado(slug);
    return { meGusta: await this.tieneMeGusta(postId, usuarioId) };
  }

  /** `PUT .../likes/yo`: idempotente — si ya había like, no hace nada. */
  async darMeGusta(slug: string, usuarioId: string): Promise<EstadoMeGustaDto> {
    const postId = await this.obtenerIdPostPublicado(slug);
    if (!(await this.tieneMeGusta(postId, usuarioId))) {
      const { error } = await this.supabase
        .getClient()
        .from('likes_blog_post')
        .insert({ post_id: postId, usuario_id: usuarioId });
      // 23505: otro request del mismo usuario ganó la carrera; ya está.
      if (error && error.code !== POSTGRES_UNIQUE_VIOLATION) {
        throw errorDeBase(error);
      }
    }
    return { total: await this.contarMeGusta(postId), meGusta: true };
  }

  /** `DELETE .../likes/yo`: idempotente — si no había like, no hace nada. */
  async quitarMeGusta(
    slug: string,
    usuarioId: string,
  ): Promise<EstadoMeGustaDto> {
    const postId = await this.obtenerIdPostPublicado(slug);
    const { error } = await this.supabase
      .getClient()
      .from('likes_blog_post')
      .delete()
      .eq('post_id', postId)
      .eq('usuario_id', usuarioId);
    if (error) throw errorDeBase(error);
    return { total: await this.contarMeGusta(postId), meGusta: false };
  }

  /** A diferencia de `obtenerPostsPublicados`, incluye borradores — uso admin. */
  async listarBlogPosts(): Promise<BlogPostDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select(BLOG_POST_SELECT)
      .order('created_at', { ascending: false })
      .returns<BlogPostDto[]>();

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async crearBlogPost(input: CrearBlogPostInput): Promise<BlogPostDto> {
    validarNuevoPost(input);

    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .insert(filaNuevoPost(input, new Date().toISOString()))
      .select(BLOG_POST_SELECT)
      .single<BlogPostDto>();

    if (error) throw this.traducirErrorEscritura(error);
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
      .maybeSingle<FilaPostActual>();
    if (errorActual) throw errorDeBase(errorActual);
    if (!actual) throw new NotFoundException('Artículo no encontrado.');

    const { data, error } = await client
      .from('blog_posts')
      .update(cambiosDePost(input, actual, new Date().toISOString()))
      .eq('id', id)
      .select(BLOG_POST_SELECT)
      .single<BlogPostDto>();

    if (error) throw this.traducirErrorEscritura(error);
    return data;
  }

  async eliminarBlogPost(id: string): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('blog_posts')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException('Artículo no encontrado.');
  }

  private async obtenerIdPostPublicado(slug: string): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .eq('estado', 'publicado')
      .maybeSingle<FilaIdPost>();

    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('Artículo no encontrado.');
    return data.id;
  }

  private async contarMeGusta(postId: string): Promise<number> {
    const { count, error } = await this.supabase
      .getClient()
      .from('likes_blog_post')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    if (error) throw errorDeBase(error);
    return count ?? 0;
  }

  private async tieneMeGusta(
    postId: string,
    usuarioId: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('likes_blog_post')
      .select('id')
      .eq('post_id', postId)
      .eq('usuario_id', usuarioId)
      .maybeSingle<FilaIdPost>();

    if (error) throw errorDeBase(error);
    return !!data;
  }

  /**
   * `slug` tiene restricción UNIQUE: un duplicado llegaba al cliente como un
   * 500 genérico. Se traduce a 409 con un mensaje que el admin puede accionar.
   */
  private traducirErrorEscritura(error: PostgrestError): HttpException {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      return new ConflictException('Ya existe un artículo con ese slug.');
    }
    return errorDeBase(error);
  }
}
