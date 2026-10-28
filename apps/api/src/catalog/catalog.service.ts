import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';

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

export interface ItemCarritoResuelto {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  /** El producto tiene más de una variante activa (ej. tamaños de pizza). */
  conTamanos: boolean;
  cantidad: number;
  /** Precio unitario vigente desde la base (oferta si hay). */
  precio: number;
}

/**
 * Un producto entra al catálogo de Meta solo si tiene foto y slug — el
 * feed lo excluye si no. El bot usa este mismo criterio para armar listas
 * de productos de WhatsApp: un `product_retailer_id` que no está en el
 * catálogo hace que Meta rechace el mensaje entero.
 */
export function entraEnCatalogoMeta<
  T extends Pick<ProductoDto, 'imagen_url' | 'slug'>,
>(producto: T): producto is T & { imagen_url: string; slug: string } {
  return Boolean(producto.imagen_url && producto.slug);
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

    if (error) throw errorDeBase(error);
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
    if (error) throw errorDeBase(error);

    return (data ?? []).map(({ variantes_producto, ...producto }) => ({
      ...producto,
      variantes: variantes_producto ?? [],
    }));
  }

  /**
   * Valida contra la base un carrito del catálogo de WhatsApp: solo quedan
   * las variantes activas de productos activos (las mismas que devuelve
   * getProductos). A diferencia de `obtenerVariantesActivas`
   * (pedidos/calcular-items.ts), no tira error si falta alguna: el bot le
   * avisa al cliente y sigue con lo que sí está disponible.
   */
  async resolverCarrito(
    items: { varianteId: string; cantidad: number }[],
  ): Promise<{ disponibles: ItemCarritoResuelto[]; noDisponibles: number }> {
    const productos = await this.getProductos();
    const porVariante = new Map(
      productos.flatMap((p) => p.variantes.map((v) => [v.id, { p, v }])),
    );
    const disponibles: ItemCarritoResuelto[] = [];
    for (const item of items) {
      const encontrado = porVariante.get(item.varianteId);
      if (!encontrado) continue;
      disponibles.push({
        varianteId: item.varianteId,
        productoNombre: encontrado.p.nombre,
        varianteNombre: encontrado.v.nombre,
        conTamanos: encontrado.p.variantes.length > 1,
        cantidad: item.cantidad,
        precio: encontrado.v.precio_oferta ?? encontrado.v.precio,
      });
    }
    return { disponibles, noDisponibles: items.length - disponibles.length };
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

    if (error) throw errorDeBase(error);
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
      if (!entraEnCatalogoMeta(producto)) {
        this.logger.warn(
          `Feed: excluido "${producto.nombre}" (${producto.id}) — ${producto.imagen_url ? 'sin slug' : 'sin imagen'}.`,
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
