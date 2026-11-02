import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_CONFIGURACION_PUNTOS } from './esquemas';
import { PuntosService } from './puntos.service';
import type { ConfiguracionPuntos } from './puntos.tipos';

@Controller('admin/puntos')
@UseGuards(RolesGuard)
export class PuntosController {
  constructor(private readonly puntos: PuntosService) {}

  @Get('configuracion')
  @Roles('admin')
  obtenerConfiguracion(): Promise<ConfiguracionPuntos> {
    return this.puntos.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles('admin')
  actualizarConfiguracion(
    @Body(new ValidarBodyPipe(ESQUEMA_CONFIGURACION_PUNTOS))
    body: Partial<ConfiguracionPuntos>,
  ): Promise<void> {
    return this.puntos.actualizarConfiguracion(body);
  }
}
