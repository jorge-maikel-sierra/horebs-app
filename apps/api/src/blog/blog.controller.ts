import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import type { CrearComentarioInput } from './blog.service';
import {
  SupabaseAuthGuard,
  UsuarioSupabaseActual,
} from '../auth/supabase-auth.guard';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_COMENTARIO } from './esquemas';
import { CachePublica } from '../common/cache-control.interceptor';

@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('posts')
  @CachePublica(60)
  getPosts() {
    return this.blog.getPostsPublicados();
  }

  @Get('posts/:slug')
  @CachePublica(60)
  async getPostPorSlug(@Param('slug') slug: string) {
    const post = await this.blog.getPostPublicadoPorSlug(slug);
    if (!post) throw new NotFoundException('Artículo no encontrado.');
    return post;
  }

  // Comentarios y likes sin @CachePublica: el cliente los vuelve a pedir justo
  // después de comentar o dar like y tienen que verse al instante.
  @Get('posts/:slug/comentarios')
  getComentarios(@Param('slug') slug: string) {
    return this.blog.getComentarios(slug);
  }

  @Post('posts/:slug/comentarios')
  @UseGuards(SupabaseAuthGuard)
  crearComentario(
    @Param('slug') slug: string,
    @Body(new ValidarBodyPipe(ESQUEMA_COMENTARIO)) body: CrearComentarioInput,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.crearComentario(slug, usuario, body);
  }

  @Delete('comentarios/:id')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  eliminarComentario(
    @Param('id', UuidPipe) id: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.eliminarComentario(id, usuario.id);
  }

  @Get('posts/:slug/likes')
  getLikes(@Param('slug') slug: string) {
    return this.blog.getLikesTotal(slug);
  }

  @Get('posts/:slug/likes/yo')
  @UseGuards(SupabaseAuthGuard)
  getMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.getMeGusta(slug, usuario.id);
  }

  @Put('posts/:slug/likes/yo')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  darMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.darMeGusta(slug, usuario.id);
  }

  // 200 con body (y no 204): el cliente necesita el total actualizado.
  @Delete('posts/:slug/likes/yo')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  quitarMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.quitarMeGusta(slug, usuario.id);
  }
}
