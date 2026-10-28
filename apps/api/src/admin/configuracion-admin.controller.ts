import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConfiguracionAdminService } from './configuracion-admin.service';

@Controller('admin/configuracion')
@UseGuards(RolesGuard)
export class ConfiguracionAdminController {
  constructor(private readonly configuracion: ConfiguracionAdminService) {}

  @Get()
  @Roles('admin')
  obtener() {
    return this.configuracion.obtenerConfiguracion();
  }

  @Patch()
  @Roles('admin')
  actualizar(
    @Body()
    body: {
      correo_domiciliario?: string;
      correo_avisos_bot?: string;
    },
  ) {
    return this.configuracion.actualizarConfiguracion({
      correo_domiciliario: body?.correo_domiciliario,
      correo_avisos_bot: body?.correo_avisos_bot,
    });
  }
}
