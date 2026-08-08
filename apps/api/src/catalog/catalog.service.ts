import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface VarianteProductoDto {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
}

export interface ProductoDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  destacado: boolean;
  categoria_id: string;
  slug: string | null;
  ventas_historicas: number | null;
  variantes: VarianteProductoDto[];
}

export interface CategoriaDto {
  id: string;
  nombre: string;
  orden: number;
}

@Injectable()
export class CatalogService {
  constructor(private readonly supabase: SupabaseService) {}

  async getCategorias(): Promise<CategoriaDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('categorias')
      .select('id, nombre, orden')
      .order('orden');

    if (error) throw error;
    return data ?? [];
  }

  async getProductos(destacado?: boolean): Promise<ProductoDto[]> {
    let query = this.supabase
      .getClient()
      .from('productos')
      .select(
        'id, nombre, descripcion, imagen_url, destacado, categoria_id, slug, ventas_historicas, variantes_producto(id, nombre, precio, precio_oferta)',
      )
      .eq('activo', true)
      .eq('variantes_producto.activo', true)
      .order('destacado', { ascending: false })
      .order('orden');

    if (destacado !== undefined) {
      query = query.eq('destacado', destacado);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map(({ variantes_producto, ...producto }) => ({
      ...producto,
      variantes: variantes_producto ?? [],
    }));
  }

  async getProductoPorSlug(slug: string): Promise<ProductoDto | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .select(
        'id, nombre, descripcion, imagen_url, destacado, categoria_id, slug, ventas_historicas, variantes_producto(id, nombre, precio, precio_oferta)',
      )
      .eq('slug', slug)
      .eq('activo', true)
      .eq('variantes_producto.activo', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { variantes_producto, ...producto } = data;
    return { ...producto, variantes: variantes_producto ?? [] };
  }
}
