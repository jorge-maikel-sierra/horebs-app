import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import {
  ESQUEMA_ESTADO_CONVERSACION,
  ESQUEMA_MENSAJE_CONVERSACION,
  ESQUEMA_SEGUIMIENTO_CONFIG,
} from './esquemas';
import { SeguimientoAdminService } from './seguimiento-admin.service';

@Controller('admin/seguimiento')
@UseGuards(RolesGuard)
export class SeguimientoAdminController {
  constructor(private readonly seguimiento: SeguimientoAdminService) {}

  @Get('configuracion')
  @Roles('admin', 'empleado')
  obtenerConfiguracion() {
    return this.seguimiento.obtenerConfiguracionSeguimiento();
  }

  @Patch('configuracion')
  @Roles('admin', 'empleado')
  actualizarConfiguracion(
    @Body(new ValidarBodyPipe(ESQUEMA_SEGUIMIENTO_CONFIG))
    body: {
      recordatorio_minutos: number;
      oferta_minutos: number;
    },
  ) {
    return this.seguimiento.actualizarConfiguracionSeguimiento(
      Number(body.recordatorio_minutos),
      Number(body.oferta_minutos),
    );
  }

  @Get('conversaciones')
  @Roles('admin', 'empleado')
  listarConversaciones() {
    return this.seguimiento.listarConversacionesBot();
  }

  @Patch('conversaciones/:id')
  @Roles('admin', 'empleado')
  actualizarEstadoConversacion(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ESTADO_CONVERSACION))
    body: { estado: string },
  ) {
    return this.seguimiento.actualizarEstadoConversacion(id, body.estado);
  }

  @Get('conversaciones/:id/mensajes')
  @Roles('admin', 'empleado')
  listarMensajes(@Param('id', UuidPipe) id: string) {
    return this.seguimiento.listarMensajesConversacion(id);
  }

  @Post('conversaciones/:id/mensajes')
  @Roles('admin', 'empleado')
  enviarMensajeHumano(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_MENSAJE_CONVERSACION))
    body: { texto: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.seguimiento.enviarMensajeHumano(id, body.texto, usuario.id);
  }

  // TEMPORAL — migración de una sola vez para traer el historial que había
  // quedado solo del lado de Gemini antes de que existiera
  // mensajes_conversacion. Borrar esta ruta (y ImportarHistorialGeminiService)
  // una vez usada.
  @Post('importar-historial-gemini')
  @Roles('admin')
  importarHistorialGemini(@Query('dryRun') dryRun?: string) {
    return this.seguimiento.importarHistorialGemini(dryRun === 'true');
  }
}
