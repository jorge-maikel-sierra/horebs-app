import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { TurnosService } from './turnos.service';
import type { CierreTurnoInput } from './turnos.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_ABRIR_TURNO, ESQUEMA_CERRAR_TURNO_ACTUAL } from './esquemas';
import { Ubicacion } from '../common/ubicacion.interceptor';

@Controller('turnos')
@UseGuards(RolesGuard)
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  @Get('actual')
  @Roles('admin', 'empleado')
  obtenerActual() {
    return this.turnos.obtenerActual();
  }

  @Post()
  @Ubicacion('/turnos/actual')
  @Roles('admin', 'empleado')
  abrir(
    @Body(new ValidarBodyPipe(ESQUEMA_ABRIR_TURNO))
    body: { monto_inicial: number },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnos.abrir(body.monto_inicial, usuario.id);
  }

  @Patch('actual')
  @Roles('admin', 'empleado')
  cerrarActual(
    @Body(new ValidarBodyPipe(ESQUEMA_CERRAR_TURNO_ACTUAL))
    body: CierreTurnoInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnos.cerrar(
      usuario.id,
      body.monto_final_contado,
      body.notas_cierre,
    );
  }
}
