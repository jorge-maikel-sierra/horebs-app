import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import type {
  BlogPostDto,
  ComentarioDto,
  CrearComentarioInput,
  EstadoMeGustaDto,
  MeGustaDto,
  TotalMeGustaDto,
} from './blog.tipos';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import { UsuarioSupabaseActual } from '../auth/usuario.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_COMENTARIO } from './esquemas';
import {
  CACHE_PUBLICA_SEGUNDOS,
  CachePublica,
} from '../common/cache-control.interceptor';

@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('posts')
  @CachePublica(CACHE_PUBLICA_SEGUNDOS)
  listarPosts(): Promise<BlogPostDto[]> {
    return this.blog.obtenerPostsPublicados();
  }

  @Get('posts/:slug')
  @CachePublica(CACHE_PUBLICA_SEGUNDOS)
  async obtenerPostPorSlug(@Param('slug') slug: string): Promise<BlogPostDto> {
    const post = await this.blog.obtenerPostPublicadoPorSlug(slug);
    if (!post) throw new NotFoundException('Artículo no encontrado.');
    return post;
  }

  // Comentarios y likes sin @CachePublica: el cliente los vuelve a pedir justo
  // después de comentar o dar like y tienen que verse al instante.
  @Get('posts/:slug/comentarios')
  obtenerComentarios(@Param('slug') slug: string): Promise<ComentarioDto[]> {
    return this.blog.obtenerComentarios(slug);
  }

  @Post('posts/:slug/comentarios')
  @UseGuards(SupabaseAuthGuard)
  crearComentario(
    @Param('slug') slug: string,
    @Body(new ValidarBodyPipe(ESQUEMA_COMENTARIO)) body: CrearComentarioInput,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ): Promise<ComentarioDto> {
    return this.blog.crearComentario(slug, usuario, body);
  }

  @Delete('comentarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseAuthGuard)
  eliminarComentario(
    @Param('id', UuidPipe) id: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ): Promise<void> {
    return this.blog.eliminarComentario(id, usuario.id);
  }

  @Get('posts/:slug/likes')
  obtenerTotalDeMeGusta(@Param('slug') slug: string): Promise<TotalMeGustaDto> {
    return this.blog.obtenerTotalMeGusta(slug);
  }

  @Get('posts/:slug/likes/yo')
  @UseGuards(SupabaseAuthGuard)
  obtenerMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ): Promise<MeGustaDto> {
    return this.blog.obtenerMeGusta(slug, usuario.id);
  }

  @Put('posts/:slug/likes/yo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  darMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ): Promise<EstadoMeGustaDto> {
    return this.blog.darMeGusta(slug, usuario.id);
  }

  // 200 con body (y no 204): el cliente necesita el total actualizado.
  @Delete('posts/:slug/likes/yo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseAuthGuard)
  quitarMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ): Promise<EstadoMeGustaDto> {
    return this.blog.quitarMeGusta(slug, usuario.id);
  }
}
