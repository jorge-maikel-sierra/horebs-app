import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { BlogService } from './blog.service';
import type { CrearBlogPostInput } from './blog.service';

/** Gestión de artículos desde el panel (incluye borradores). */
@Controller('admin/blog')
@UseGuards(RolesGuard)
export class BlogAdminController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  @Roles('admin')
  listar() {
    return this.blog.listarBlogPosts();
  }

  @Post()
  @Roles('admin')
  crear(@Body() body: CrearBlogPostInput) {
    return this.blog.crearBlogPost(body);
  }

  @Patch(':id')
  @Roles('admin')
  actualizar(
    @Param('id', UuidPipe) id: string,
    @Body() body: Partial<CrearBlogPostInput>,
  ) {
    return this.blog.actualizarBlogPost(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  eliminar(@Param('id', UuidPipe) id: string) {
    return this.blog.eliminarBlogPost(id);
  }
}
