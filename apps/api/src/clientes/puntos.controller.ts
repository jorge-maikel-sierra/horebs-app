import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PuntosService } from './puntos.service';
import type { ConfiguracionPuntos } from './puntos.service';

@Controller('admin/puntos')
@UseGuards(RolesGuard)
export class PuntosController {
  constructor(private readonly puntos: PuntosService) {}

  @Get('configuracion')
  @Roles('admin')
  obtenerConfiguracion() {
    return this.puntos.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles('admin')
  actualizarConfiguracion(@Body() body: Partial<ConfiguracionPuntos>) {
    return this.puntos.actualizarConfiguracion(body);
  }
}
