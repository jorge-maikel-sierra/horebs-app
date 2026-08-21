import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportesService } from './reportes.service';

@Controller('inventario/reportes')
@UseGuards(RolesGuard)
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get()
  @Roles('admin', 'empleado')
  obtener() {
    return this.reportes.obtenerReporte();
  }
}
