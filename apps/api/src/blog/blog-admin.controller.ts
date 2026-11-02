import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { BlogService } from './blog.service';
import type { BlogPostDto, CrearBlogPostInput } from './blog.tipos';
import { ESQUEMA_CREAR_POST, ESQUEMA_EDITAR_POST } from './esquemas';

/** Gestión de artículos desde el panel (incluye borradores). */
@Controller('admin/blog')
@UseGuards(RolesGuard)
export class BlogAdminController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Roles('admin')
  listar(): Promise<BlogPostDto[]> {
    return this.blog.listarBlogPosts();
  }

  @Post()
  @Roles('admin')
  crear(
    @Body(new ValidarBodyPipe(ESQUEMA_CREAR_POST)) body: CrearBlogPostInput,
  ): Promise<BlogPostDto> {
    return this.blog.crearBlogPost(body);
  }

  @Patch(':id')
  @Roles('admin')
  actualizar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_POST))
    body: Partial<CrearBlogPostInput>,
  ): Promise<BlogPostDto> {
    return this.blog.actualizarBlogPost(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  eliminar(@Param('id', UuidPipe) id: string): Promise<void> {
    return this.blog.eliminarBlogPost(id);
  }
}
