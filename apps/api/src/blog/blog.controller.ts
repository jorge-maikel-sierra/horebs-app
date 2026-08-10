import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { BlogService } from './blog.service';

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
}
