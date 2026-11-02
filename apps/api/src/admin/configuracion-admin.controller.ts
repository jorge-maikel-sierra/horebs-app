import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ConfiguracionAdminService } from './configuracion-admin.service';
import type { ConfiguracionCorreos } from './configuracion-admin.service';
import { ESQUEMA_CONFIGURACION_CORREOS } from './esquemas';

@Controller('admin/configuracion')
@UseGuards(RolesGuard)
export class ConfiguracionAdminController {
  constructor(private readonly configuracion: ConfiguracionAdminService) {}

  @Get()
  @Roles('admin')
  obtener(): Promise<ConfiguracionCorreos> {
    return this.configuracion.obtenerConfiguracion();
  }

  @Patch()
  @Roles('admin')
  actualizar(
    @Body(new ValidarBodyPipe(ESQUEMA_CONFIGURACION_CORREOS))
    body: {
      correo_domiciliario?: string;
      correo_avisos_bot?: string;
    },
  ): Promise<ConfiguracionCorreos> {
    return this.configuracion.actualizarConfiguracion({
      correo_domiciliario: body.correo_domiciliario,
      correo_avisos_bot: body.correo_avisos_bot,
    });
  }
}
