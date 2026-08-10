import { Injectable } from '@nestjs/common';
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

const BLOG_POST_SELECT =
  'id, titulo, slug, resumen, contenido, palabra_clave, imagen_url, estado, publicado_en, created_at';

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
}
