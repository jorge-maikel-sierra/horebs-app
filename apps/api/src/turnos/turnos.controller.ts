import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { TurnosService } from './turnos.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';

@Controller('turnos')
@UseGuards(RolesGuard)
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  @Get('actual')
  @Roles('admin', 'empleado')
  obtenerActual() {
    return this.turnos.obtenerActual();
  }

  @Post('abrir')
  @Roles('admin', 'empleado')
  abrir(
    @Body() body: { monto_inicial: number },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnos.abrir(body.monto_inicial, usuario.id);
  }

  @Post('cerrar')
  @Roles('admin', 'empleado')
  cerrar(
    @Body() body: { monto_final_contado?: number; notas_cierre?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.turnos.cerrar(
      usuario.id,
      body.monto_final_contado,
      body.notas_cierre,
    );
  }
}
