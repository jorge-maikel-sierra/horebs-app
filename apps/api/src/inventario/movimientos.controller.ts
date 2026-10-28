import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MAX_LIMITE, MovimientosService } from './movimientos.service';
import { UuidOpcionalPipe } from '../common/pipes/uuid.pipe';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import { LimitePipe } from '../common/pipes/limite.pipe';

@Controller('inventario/movimientos')
@UseGuards(RolesGuard)
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(
    @Query('insumoId', UuidOpcionalPipe) insumoId?: string,
    @Query('tipo') tipo?: string,
    @Query('desde', new FechaPipe('desde')) desde?: string,
    @Query('hasta', new FechaPipe('hasta')) hasta?: string,
    @Query('limit', new LimitePipe(MAX_LIMITE)) limit?: number,
  ) {
    return this.movimientos.listar({
      insumoId,
      tipo,
      desde,
      hasta,
      limit,
    });
  }
}
