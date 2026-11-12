import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversacionesService } from '../mensajeria/conversaciones.service';
import type {
  ConversacionCompleta,
  EstadoConversacion,
  MensajeConversacion,
} from '../mensajeria/conversaciones.tipos';
import { dentroDeLaVentana } from '../mensajeria/avisos-pedido';
import { MetaGraphService } from '../mensajeria/meta-graph.service';

const LIMITE_MENSAJE = 4096;

export interface ConfiguracionSeguimientoDto {
  recordatorio_minutos: number;
  oferta_minutos: number;
}

export interface EstadoConversacionDto {
  id: string;
  estado: EstadoConversacion;
}

/** Seguimiento del bot desde el panel: configuración, conversaciones y mensajes. */
@Injectable()
export class SeguimientoAdminService {
  private readonly logger = new Logger(SeguimientoAdminService.name);

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  async obtenerConfiguracionSeguimiento(): Promise<ConfiguracionSeguimientoDto> {
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
  ): Promise<ConfiguracionSeguimientoDto> {
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

  async listarConversacionesBot(): Promise<ConversacionCompleta[]> {
    return this.conversaciones.listar();
  }

  async actualizarEstadoConversacion(
    id: string,
    estado: string,
  ): Promise<EstadoConversacionDto> {
    if (estado !== 'bot' && estado !== 'derivado') {
      throw new BadRequestException(
        'Estado inválido — debe ser "bot" o "derivado".',
      );
    }
    await this.conversaciones.actualizarEstadoManual(id, estado);
    return { id, estado };
  }

  async listarMensajesConversacion(id: string): Promise<MensajeConversacion[]> {
    const conversacion = await this.conversaciones.obtenerPorId(id);
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada.');
    }
    return this.conversaciones.listarMensajes(id);
  }

  /**
   * Meta rechaza cualquier mensaje libre pasadas 24 h desde el último del
   * cliente: se avisa claro en vez de dejar que falle en Graph.
   */
  private exigirVentanaAbierta(conversacion: ConversacionCompleta): void {
    const ultima = new Date(conversacion.ultima_interaccion);
    if (!dentroDeLaVentana(ultima, new Date())) {
      throw new ConflictException(
        'Pasaron más de 24 horas desde el último mensaje del cliente: Meta no deja escribirle por este chat hasta que él vuelva a escribir. Contáctalo por teléfono si es urgente.',
      );
    }
  }

  /** Un admin/empleado le contesta directo a un cliente derivado — resuelve
   * canal/identificador_externo sin que el frontend tenga que conocerlos,
   * manda el mensaje real vía Graph API, y lo deja registrado como
   * `saliente_humano` con quién lo mandó. */
  async enviarMensajeHumano(
    id: string,
    texto: string,
    usuarioId: string,
  ): Promise<MensajeConversacion> {
    const textoLimpio = texto?.trim() ?? '';
    if (!textoLimpio) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    if (textoLimpio.length > LIMITE_MENSAJE) {
      throw new BadRequestException(
        `El mensaje no puede superar los ${LIMITE_MENSAJE} caracteres.`,
      );
    }

    const conversacion = await this.conversaciones.obtenerPorId(id);
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada.');
    }
    this.exigirVentanaAbierta(conversacion);

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
}
