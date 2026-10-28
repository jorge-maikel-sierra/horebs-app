import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { NominaService, type RegistrarAdelantoInput } from './nomina.service';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { FechaPipe } from '../common/pipes/fecha.pipe';
import { LimitePipe } from '../common/pipes/limite.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import {
  ESQUEMA_ASISTENCIA,
  ESQUEMA_LIQUIDAR_SEMANA,
  ESQUEMA_REGISTRAR_ADELANTO,
} from './esquemas';

/** Semanas de histórico que se pueden pedir de una vez (un año). */
const LIMITE_MAX_HISTORICO = 52;

@Controller('nomina')
@UseGuards(RolesGuard)
export class NominaController {
  constructor(private readonly nomina: NominaService) {}

  @Get('tablero')
  @Roles('admin')
  tablero(
    @Query('semana_inicio', new FechaPipe('semana_inicio'))
    semanaInicio?: string,
  ) {
    return this.nomina.listarTableroSemanaActual(semanaInicio);
  }

  @Get('semanas/:id')
  @Roles('admin')
  obtenerSemana(@Param('id', UuidPipe) id: string) {
    return this.nomina.obtenerSemana(id);
  }

  @Put('semanas/:id/asistencia/:fecha')
  @Roles('admin')
  marcarAsistencia(
    @Param('id', UuidPipe) id: string,
    @Param('fecha', new FechaPipe('fecha')) fecha: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ASISTENCIA))
    body: { trabajo: boolean; motivo?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.marcarAsistencia(
      id,
      fecha,
      body.trabajo,
      body.motivo,
      usuario.id,
    );
  }

  @Put('semanas/:id/liquidacion')
  @Roles('admin')
  liquidacion(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_LIQUIDAR_SEMANA))
    body: { notas?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.asegurarLiquidada(id, usuario.id, body.notas);
  }

  @Post('adelantos')
  @Roles('admin')
  registrarAdelanto(
    @Body(new ValidarBodyPipe(ESQUEMA_REGISTRAR_ADELANTO))
    body: RegistrarAdelantoInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.nomina.registrarAdelanto(body, usuario.id);
  }

  @Delete('adelantos/:id')
  @HttpCode(204)
  @Roles('admin')
  eliminarAdelanto(@Param('id', UuidPipe) id: string) {
    return this.nomina.eliminarAdelanto(id);
  }

  @Get('empleados/:id/historico')
  @Roles('admin')
  historicoEmpleado(@Param('id', UuidPipe) id: string) {
    return this.nomina.obtenerHistoricoEmpleado(id);
  }

  @Get('yo/semana-actual')
  @Roles('admin', 'empleado')
  async semanaActualDeUsuario(@UsuarioActual() usuario: UsuarioAutenticado) {
    // Nest/Express devuelven body vacío (no "null") cuando el handler
    // retorna null directo — se envuelve en un objeto para que el
    // cliente siempre reciba JSON válido, sin trabajador vinculado o con él.
    const semana = await this.nomina.obtenerMiSemanaActual(usuario.id);
    return { semana };
  }

  @Get('yo/historico')
  @Roles('admin', 'empleado')
  historicoDeUsuario(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Query('limit', new LimitePipe(LIMITE_MAX_HISTORICO)) limite?: number,
  ) {
    return this.nomina.listarMiHistorico(usuario.id, limite);
  }
}
