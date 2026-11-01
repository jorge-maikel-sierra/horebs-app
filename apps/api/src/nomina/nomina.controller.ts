import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { NominaService } from './nomina.service';
import type {
  AdelantoDto,
  AsistenciaBody,
  LiquidarSemanaBody,
  RegistrarAdelantoInput,
  SemanaNominaDto,
  TableroFilaDto,
} from './nomina.tipos';
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
  ): Promise<TableroFilaDto[]> {
    return this.nomina.listarTableroSemanaActual(semanaInicio);
  }

  @Get('semanas/:id')
  @Roles('admin')
  obtenerSemana(@Param('id', UuidPipe) id: string): Promise<SemanaNominaDto> {
    return this.nomina.obtenerSemana(id);
  }

  @Put('semanas/:id/asistencia/:fecha')
  @Roles('admin')
  marcarAsistencia(
    @Param('id', UuidPipe) id: string,
    @Param('fecha', new FechaPipe('fecha')) fecha: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ASISTENCIA))
    body: AsistenciaBody,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.nomina.marcarAsistencia({
      semanaId: id,
      fecha,
      trabajo: body.trabajo,
      motivo: body.motivo,
      usuarioId: usuario.id,
    });
  }

  @Put('semanas/:id/liquidacion')
  @Roles('admin')
  liquidacion(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_LIQUIDAR_SEMANA))
    body: LiquidarSemanaBody,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<SemanaNominaDto> {
    return this.nomina.asegurarLiquidada(id, usuario.id, body.notas);
  }

  @Post('adelantos')
  @Roles('admin')
  registrarAdelanto(
    @Body(new ValidarBodyPipe(ESQUEMA_REGISTRAR_ADELANTO))
    body: RegistrarAdelantoInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<AdelantoDto> {
    return this.nomina.registrarAdelanto(body, usuario.id);
  }

  @Delete('adelantos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  eliminarAdelanto(@Param('id', UuidPipe) id: string): Promise<void> {
    return this.nomina.eliminarAdelanto(id);
  }

  @Get('empleados/:id/historico')
  @Roles('admin')
  historicoEmpleado(
    @Param('id', UuidPipe) id: string,
  ): Promise<SemanaNominaDto[]> {
    return this.nomina.obtenerHistoricoEmpleado(id);
  }

  @Get('yo/semana-actual')
  @Roles('admin', 'empleado')
  async semanaActualDeUsuario(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<{ semana: SemanaNominaDto | null }> {
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
  ): Promise<SemanaNominaDto[]> {
    return this.nomina.listarMiHistorico(usuario.id, limite);
  }
}
