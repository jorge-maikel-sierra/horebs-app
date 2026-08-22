import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const SITIO_URL = 'https://pizzeriahorebs.shop';
const MARCA = 'Pizzería Horebs';
const MONEDA = 'COP';

const COLUMNAS_FEED = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'item_group_id',
  'sale_price',
  'status',
  'custom_label_0',
] as const;

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
  private readonly logger = new Logger(CatalogService.name);

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

  /**
   * Feed de catálogo para Meta Commerce Manager (fuente de datos programada).
   * Formato y campos según las especificaciones oficiales de Meta:
   * https://www.facebook.com/business/help/120325381656392
   *
   * El `id` de cada fila es el UUID de la variante — debe calzar exacto con
   * el `item_id`/`content_ids` que ya manda el píxel en cada evento
   * (ver apps/web/src/lib/analytics.ts), o Meta no puede vincular un clic en
   * un anuncio de catálogo con la conversión real en el sitio.
   */
  async getFeedCsv(): Promise<string> {
    const [productos, categorias] = await Promise.all([
      this.getProductos(),
      this.getCategorias(),
    ]);
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));

    const filas: string[][] = [];

    for (const producto of productos) {
      if (!producto.imagen_url) {
        this.logger.warn(
          `Feed: excluido "${producto.nombre}" (${producto.id}) — sin imagen.`,
        );
        continue;
      }
      if (!producto.slug) {
        this.logger.warn(
          `Feed: excluido "${producto.nombre}" (${producto.id}) — sin slug.`,
        );
        continue;
      }

      const esGrupoDeVariantes = producto.variantes.length > 1;
      const link = `${SITIO_URL}/menu/${producto.slug}`;
      const descripcion =
        producto.descripcion?.trim() ||
        `${producto.nombre} — Pizzería Horebs, Riohacha.`;

      for (const variante of producto.variantes) {
        const title = esGrupoDeVariantes
          ? `${producto.nombre} - ${variante.nombre}`
          : producto.nombre;
        const tieneOferta =
          variante.precio_oferta != null &&
          variante.precio_oferta < variante.precio;

        filas.push([
          variante.id,
          title,
          descripcion,
          'in stock',
          'new',
          `${variante.precio.toFixed(2)} ${MONEDA}`,
          link,
          producto.imagen_url,
          MARCA,
          esGrupoDeVariantes ? producto.id : '',
          tieneOferta ? `${variante.precio_oferta!.toFixed(2)} ${MONEDA}` : '',
          'active',
          nombreCategoria.get(producto.categoria_id) ?? '',
        ]);
      }
    }

    const lineas = [
      COLUMNAS_FEED.join(','),
      ...filas.map((fila) => fila.map(escaparCampoCsv).join(',')),
    ];
    return lineas.join('\n');
  }
}

function escaparCampoCsv(valor: string): string {
  if (/[",\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}
