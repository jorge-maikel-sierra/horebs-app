import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { InsumosService } from './insumos.service';
import type { CrearInsumoInput, TipoAjusteStock, UnidadMedida } from './insumos.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';

@Controller('inventario/insumos')
@UseGuards(RolesGuard)
export class InsumosController {
  constructor(private readonly insumos: InsumosService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(@Query('stockBajo') stockBajo?: string) {
    return this.insumos.listar(stockBajo === 'true');
  }

  @Post()
  @Roles('admin', 'empleado')
  crear(@Body() body: CrearInsumoInput) {
    return this.insumos.crear(body);
  }

  @Patch(':id')
  @Roles('admin', 'empleado')
  editar(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      categoria?: string;
      unidad_medida?: UnidadMedida;
      stock_minimo_g?: number;
      proveedor_principal?: string;
      activo?: boolean;
    },
  ) {
    return this.insumos.editar(id, body);
  }

  @Post(':id/ajuste')
  @Roles('admin', 'empleado')
  ajustarStock(
    @Param('id') id: string,
    @Body() body: { tipo: TipoAjusteStock; cantidad_g: number; motivo: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.insumos.ajustarStock(id, body.tipo, body.cantidad_g, body.motivo, usuario.id);
  }
}
