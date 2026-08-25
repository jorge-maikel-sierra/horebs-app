import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { NominaService, type RegistrarAdelantoInput } from './nomina.service';

@Controller('nomina')
@UseGuards(RolesGuard)
export class NominaController {
  constructor(private readonly nomina: NominaService) {}

  @Get('tablero')
  @Roles('admin')
  tablero(@Query('semana_inicio') semanaInicio?: string) {
    return this.nomina.listarTableroSemanaActual(semanaInicio);
  }

  @Get('semanas/:id')
  @Roles('admin')
  obtenerSemana(@Param('id') id: string) {
    return this.nomina.obtenerSemana(id);
  }

  @Put('semanas/:id/asistencia/:fecha')
  @Roles('admin')
  marcarAsistencia(
    @Param('id') id: string,
    @Param('fecha') fecha: string,
    @Body() body: { trabajo: boolean; motivo?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.marcarAsistencia(id, fecha, body.trabajo, body.motivo, usuario.id);
  }

  @Post('semanas/:id/liquidar')
  @Roles('admin')
  liquidar(
    @Param('id') id: string,
    @Body() body: { notas?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.liquidar(id, usuario.id, body.notas);
  }

  @Post('adelantos')
  @Roles('admin')
  registrarAdelanto(
    @Body() body: RegistrarAdelantoInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.registrarAdelanto(body, usuario.id);
  }

  @Delete('adelantos/:id')
  @Roles('admin')
  eliminarAdelanto(@Param('id') id: string) {
    return this.nomina.eliminarAdelanto(id);
  }

  @Get('empleados/:id/historico')
  @Roles('admin')
  historicoEmpleado(@Param('id') id: string) {
    return this.nomina.obtenerHistoricoEmpleado(id);
  }

  @Get('mi-semana')
  @Roles('admin', 'empleado')
  async miSemana(@UsuarioActual() usuario: UsuarioAutenticado) {
    // Nest/Express devuelven body vacío (no "null") cuando el handler
    // retorna null directo — se envuelve en un objeto para que el
    // cliente siempre reciba JSON válido, sin trabajador vinculado o con él.
    const semana = await this.nomina.obtenerMiSemanaActual(usuario.id);
    return { semana };
  }

  @Get('mi-historico')
  @Roles('admin', 'empleado')
  miHistorico(@UsuarioActual() usuario: UsuarioAutenticado, @Query('limit') limit?: string) {
    const limite = limit ? Number(limit) : undefined;
    return this.nomina.listarMiHistorico(usuario.id, limite);
  }
}
