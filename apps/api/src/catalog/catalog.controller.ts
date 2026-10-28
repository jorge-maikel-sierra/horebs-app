import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CachePublica } from '../common/cache-control.interceptor';

@Controller('catalogo')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categorias')
  @CachePublica(60)
  getCategorias() {
    return this.catalog.getCategorias();
  }

  /** Fuente de datos programada para Meta Commerce Manager. */
  @Get('feed.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  getFeedCsv() {
    return this.catalog.getFeedCsv();
  }

  @Get('productos')
  @CachePublica(60)
  getProductos(@Query('destacado') destacado?: string) {
    const filtro = destacado === undefined ? undefined : destacado === 'true';
    return this.catalog.getProductos(filtro);
  }

  @Get('productos/:slug')
  @CachePublica(60)
  async getProductoPorSlug(@Param('slug') slug: string) {
    const producto = await this.catalog.getProductoPorSlug(slug);
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }
}
