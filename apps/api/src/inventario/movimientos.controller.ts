import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsultaMovimientosPipe } from './consulta-movimientos.pipe';
import { MovimientosService } from './movimientos.service';
import type { FiltrosMovimientos, MovimientoDto } from './movimientos.tipos';

@Controller('inventario/movimientos')
@UseGuards(RolesGuard)
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(
    @Query(ConsultaMovimientosPipe) filtros: FiltrosMovimientos,
  ): Promise<MovimientoDto[]> {
    return this.movimientos.listar(filtros);
  }
}
