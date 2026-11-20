import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_ACTUALIZAR_RESENA } from './esquemas';
import { EstadoResenaPipe } from './estado-resena.pipe';
import { ResenasService } from './resenas.service';
import type {
  ActualizarResenaInput,
  EstadoResena,
  ResenaDto,
} from './resenas.tipos';

/** Reseñas de Google: el equipo aprueba, edita o descarta las respuestas. */
@Controller('admin/resenas')
@UseGuards(RolesGuard)
export class ResenasAdminController {
  constructor(private readonly resenas: ResenasService) {}

  /** `?estado=para_revisar` filtra; sin filtro, las 100 más recientes. */
  @Get()
  @Roles('admin', 'empleado')
  listar(
    @Query('estado', EstadoResenaPipe) estado?: EstadoResena,
  ): Promise<ResenaDto[]> {
    return this.resenas.listar(estado);
  }

  /** `estado: respondida` publica la respuesta en Google; `descartada` la deja sin responder. */
  @Patch(':id')
  @Roles('admin', 'empleado')
  actualizar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ACTUALIZAR_RESENA))
    body: ActualizarResenaInput,
  ): Promise<ResenaDto> {
    return this.resenas.actualizar(id, body);
  }
}
