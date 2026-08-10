import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import type { CrearComentarioInput } from './blog.service';
import {
  SupabaseAuthGuard,
  UsuarioSupabaseActual,
} from '../auth/supabase-auth.guard';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';

@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('posts')
  getPosts() {
    return this.blog.getPostsPublicados();
  }

  @Get('posts/:slug')
  async getPostPorSlug(@Param('slug') slug: string) {
    const post = await this.blog.getPostPublicadoPorSlug(slug);
    if (!post) throw new NotFoundException('Artículo no encontrado.');
    return post;
  }

  @Get('posts/:slug/comentarios')
  getComentarios(@Param('slug') slug: string) {
    return this.blog.getComentarios(slug);
  }

  @Post('posts/:slug/comentarios')
  @UseGuards(SupabaseAuthGuard)
  crearComentario(
    @Param('slug') slug: string,
    @Body() body: CrearComentarioInput,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    const nombre = `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
    return this.blog.crearComentario(slug, usuario.id, nombre, body);
  }

  @Delete('comentarios/:id')
  @UseGuards(SupabaseAuthGuard)
  eliminarComentario(
    @Param('id') id: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.eliminarComentario(id, usuario.id);
  }

  @Get('posts/:slug/likes')
  getLikes(@Param('slug') slug: string) {
    return this.blog.getLikesTotal(slug);
  }

  @Get('posts/:slug/likes/estado')
  @UseGuards(SupabaseAuthGuard)
  getMeGusta(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.getMeGusta(slug, usuario.id);
  }

  @Post('posts/:slug/likes')
  @UseGuards(SupabaseAuthGuard)
  toggleLike(
    @Param('slug') slug: string,
    @UsuarioSupabaseActual() usuario: UsuarioSupabase,
  ) {
    return this.blog.toggleLike(slug, usuario.id);
  }
}
