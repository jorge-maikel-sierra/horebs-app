import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalogo')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categorias')
  getCategorias() {
    return this.catalog.getCategorias();
  }

  @Get('productos')
  getProductos(@Query('destacado') destacado?: string) {
    const filtro = destacado === undefined ? undefined : destacado === 'true';
    return this.catalog.getProductos(filtro);
  }
}
