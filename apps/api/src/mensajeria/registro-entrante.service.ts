import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import { origenDeProcedencia } from './origen-conversacion';
import { OrigenConversacionService } from './origen-conversacion.service';
import type {
  EcoHumano,
  EventoEntrante,
  ReferidoSocial,
} from './parseo-webhook';

/**
 * Lo que se guarda de cada mensaje entrante antes de responder: el dedupe por
 * id de mensaje, la conversación, el mensaje en el historial y de dónde llegó
 * el cliente (anuncio, enlace con `ref`, clic de WhatsApp).
 */
@Injectable()
export class RegistroEntranteService {
  private readonly logger = new Logger(RegistroEntranteService.name);

  /** Id de nuestra app de Meta: sus ecos son del bot o del panel, no de una persona. */
  readonly appIdBot: string | undefined;

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly origenes: OrigenConversacionService,
    config: ConfigService,
  ) {
    this.appIdBot = config.get<string>('META_APP_ID');
  }

  async esDuplicado(evento: EventoEntrante): Promise<boolean> {
    if (!evento.mensajeId) return false;
    let duplicado = false;
    try {
      duplicado = await this.conversaciones.yaProcesado(
        evento.canal,
        evento.mensajeId,
      );
    } catch (err) {
      // Si la verificación de duplicado en sí falla (no el chequeo, sino
      // el acceso a la tabla), se prefiere procesar el mensaje de más en
      // un caso raro antes que perder un mensaje real del cliente.
      this.logger.error(
        `No se pudo verificar duplicado del mensaje ${evento.mensajeId} — se procesa igual: ${(err as Error).message}`,
      );
    }
    if (duplicado) {
      this.logger.log(
        `Mensaje ${evento.mensajeId} ya procesado (reenvío de Meta) — se ignora.`,
      );
    }
    return duplicado;
  }

  /**
   * Se persiste el mensaje entrante ANTES del corte por `derivado` — si no,
   * el mensaje del cliente se perdía por completo una vez que la
   * conversación ya estaba en manos de una persona.
   */
  async registrar(
    evento: EventoEntrante,
    textoHistorial: string,
  ): Promise<ConversacionCompleta> {
    const conversacion = await this.conversaciones.registrarInteraccion(
      evento.canal,
      evento.identificadorExterno,
    );
    this.guardarCtwaClid(evento);
    this.guardarOrigen(evento);
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'entrante',
      textoHistorial,
    );
    return conversacion;
  }

  /** Referral sin mensaje: solo se guarda el origen, el bot no responde. */
  async registrarReferido(referido: ReferidoSocial): Promise<void> {
    const origen = origenDeProcedencia(referido.procedencia);
    if (!origen) return;
    this.logger.log(
      `Referral sin mensaje — canal=${referido.canal} id=${referido.identificadorExterno} fuente=${origen.fuente} anuncio_id=${origen.anuncioId ?? '-'} ref=${origen.ref ?? '-'}`,
    );
    await this.origenes.registrar(
      referido.canal,
      referido.identificadorExterno,
      origen,
    );
  }

  /**
   * Alguien del equipo contestó desde Meta Business Suite: la conversación
   * pasa a manos del equipo (el bot se calla) y el mensaje queda en el
   * historial del panel. Se devuelve al bot desde el panel.
   */
  async registrarEcoHumano(eco: EcoHumano): Promise<void> {
    if (eco.mensajeId) {
      const repetido = await this.conversaciones.yaProcesado(
        eco.canal,
        eco.mensajeId,
      );
      if (repetido) return;
    }
    const conversacion = await this.conversaciones.obtenerVentana(
      eco.canal,
      eco.identificadorExterno,
    );
    if (!conversacion) return;
    if (conversacion.estado !== 'derivado') {
      await this.conversaciones.actualizarEstadoManual(
        conversacion.conversacionId,
        'derivado',
      );
      this.logger.log(
        `El equipo respondió desde Meta — canal=${eco.canal} id=${eco.identificadorExterno}: el bot se pausa.`,
      );
    }
    await this.conversaciones.registrarMensaje(
      conversacion.conversacionId,
      'saliente_humano',
      eco.texto,
    );
  }

  /**
   * Fire-and-forget: el origen es un dato para medir, no para el bot; si
   * falla no debe demorar ni tumbar la respuesta al cliente.
   */
  private guardarOrigen(evento: EventoEntrante): void {
    const origen = origenDeProcedencia(evento.procedenciaAnuncio);
    if (!origen) return;
    this.logger.log(
      `Conversación con origen — canal=${evento.canal} id=${evento.identificadorExterno} fuente=${origen.fuente} anuncio_id=${origen.anuncioId ?? '-'} ref=${origen.ref ?? '-'}`,
    );
    void this.origenes
      .registrar(evento.canal, evento.identificadorExterno, origen)
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo guardar el origen de ${evento.identificadorExterno}: ${err.message}`,
        ),
      );
  }

  private guardarCtwaClid(evento: EventoEntrante): void {
    const ctwaClid = evento.procedenciaAnuncio?.ctwaClid;
    if (evento.canal !== 'whatsapp' || !ctwaClid) return;
    void this.origenes
      .guardarCtwaClid(evento.canal, evento.identificadorExterno, ctwaClid)
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo guardar el ctwa_clid de ${evento.identificadorExterno}: ${err.message}`,
        ),
      );
  }
}
