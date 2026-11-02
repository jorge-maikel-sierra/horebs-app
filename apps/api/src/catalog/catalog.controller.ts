import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { CategoriaDto, ProductoDto } from './catalog.service';
import {
  CACHE_PUBLICA_SEGUNDOS,
  CachePublica,
} from '../common/cache-control.interceptor';

@Controller('catalogo')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categorias')
  @CachePublica(CACHE_PUBLICA_SEGUNDOS)
  getCategorias(): Promise<CategoriaDto[]> {
    return this.catalog.getCategorias();
  }

  /** Fuente de datos programada para Meta Commerce Manager. */
  @Get('feed.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  getFeedCsv(): Promise<string> {
    return this.catalog.getFeedCsv();
  }

  @Get('productos')
  @CachePublica(CACHE_PUBLICA_SEGUNDOS)
  getProductos(@Query('destacado') destacado?: string): Promise<ProductoDto[]> {
    const filtro = destacado === undefined ? undefined : destacado === 'true';
    return this.catalog.getProductos(filtro);
  }

  @Get('productos/:slug')
  @CachePublica(CACHE_PUBLICA_SEGUNDOS)
  async getProductoPorSlug(@Param('slug') slug: string): Promise<ProductoDto> {
    const producto = await this.catalog.getProductoPorSlug(slug);
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }
}
