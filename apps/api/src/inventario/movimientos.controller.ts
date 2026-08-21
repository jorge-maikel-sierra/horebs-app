import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MovimientosService } from './movimientos.service';

@Controller('inventario/movimientos')
@UseGuards(RolesGuard)
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(
    @Query('insumoId') insumoId?: string,
    @Query('tipo') tipo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
  ) {
    return this.movimientos.listar({
      insumoId,
      tipo,
      desde,
      hasta,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
