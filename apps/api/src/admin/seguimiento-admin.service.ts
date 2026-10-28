import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversacionesService } from '../mensajeria/conversaciones.service';
import { MetaGraphService } from '../mensajeria/meta-graph.service';
import { ImportarHistorialGeminiService } from '../mensajeria/importar-historial-gemini.service';

/** Seguimiento del bot desde el panel: configuración, conversaciones y mensajes. */
@Injectable()
export class SeguimientoAdminService {
  private readonly logger = new Logger(SeguimientoAdminService.name);

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly importarHistorial: ImportarHistorialGeminiService,
  ) {}

  async obtenerConfiguracionSeguimiento() {
    const { recordatorioMinutos, ofertaMinutos } =
      await this.conversaciones.obtenerConfiguracionSeguimiento();
    return {
      recordatorio_minutos: recordatorioMinutos,
      oferta_minutos: ofertaMinutos,
    };
  }

  async actualizarConfiguracionSeguimiento(
    recordatorioMinutos: number,
    ofertaMinutos: number,
  ) {
    if (
      !Number.isInteger(recordatorioMinutos) ||
      !Number.isInteger(ofertaMinutos) ||
      recordatorioMinutos < 1 ||
      ofertaMinutos < 1
    ) {
      throw new BadRequestException('Los minutos deben ser enteros positivos.');
    }
    await this.conversaciones.actualizarConfiguracionSeguimiento(
      recordatorioMinutos,
      ofertaMinutos,
    );
    return {
      recordatorio_minutos: recordatorioMinutos,
      oferta_minutos: ofertaMinutos,
    };
  }

  async listarConversacionesBot() {
    return this.conversaciones.listar();
  }

  async actualizarEstadoConversacion(id: string, estado: string) {
    if (estado !== 'bot' && estado !== 'derivado') {
      throw new BadRequestException(
        'Estado inválido — debe ser "bot" o "derivado".',
      );
    }
    await this.conversaciones.actualizarEstadoManual(id, estado);
    return { id, estado };
  }

  async listarMensajesConversacion(id: string) {
    const conversacion = await this.conversaciones.obtenerPorId(id);
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada.');
    }
    return this.conversaciones.listarMensajes(id);
  }

  /** Un admin/empleado le contesta directo a un cliente derivado — resuelve
   * canal/identificador_externo sin que el frontend tenga que conocerlos,
   * manda el mensaje real vía Graph API, y lo deja registrado como
   * `saliente_humano` con quién lo mandó. */
  async enviarMensajeHumano(id: string, texto: string, usuarioId: string) {
    const textoLimpio = texto?.trim() ?? '';
    if (!textoLimpio) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    if (textoLimpio.length > 4096) {
      throw new BadRequestException(
        'El mensaje no puede superar los 4096 caracteres.',
      );
    }

    const conversacion = await this.conversaciones.obtenerPorId(id);
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada.');
    }

    try {
      await this.metaGraph.enviarMensajeSesion(
        conversacion.canal,
        conversacion.identificador_externo,
        textoLimpio,
      );
    } catch (err) {
      // Graph API puede fallar (token vencido, ventana de 24 h cerrada, 5xx):
      // se traduce a un error de Nest con el motivo en vez de un 500 genérico.
      const motivo = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `No se pudo enviar el mensaje humano a ${conversacion.canal}: ${motivo}`,
      );
      throw new BadRequestException(
        `No se pudo enviar el mensaje por ${conversacion.canal}: ${motivo}`,
      );
    }
    return this.conversaciones.registrarMensaje(
      id,
      'saliente_humano',
      textoLimpio,
      usuarioId,
    );
  }

  /** TEMPORAL — ver comentario en admin.controller.ts. */
  importarHistorialGemini(dryRun: boolean) {
    return this.importarHistorial.importarTodas(dryRun);
  }
}
