import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { CatalogService } from '../catalog/catalog.service';
import { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import { MediaEntranteService } from './media-entrante.service';
import {
  parsearMessengerOInstagram,
  parsearWhatsapp,
  textoCarritoCatalogo,
  type EventoEntrante,
  type MessengerWebhookPayload,
  type WhatsappWebhookPayload,
} from './parseo-webhook';
import {
  RespuestaBotService,
  type CarritoValidado,
} from './respuesta-bot.service';

/**
 * Verifica la firma, parsea el payload (WhatsApp vs Messenger/Instagram
 * tienen forma distinta), detecta si la conversación viene de un clic en
 * anuncio, y orquesta la respuesta — todo llamado sin `await` desde el
 * controller (mismo patrón fire-and-forget que MailService) para poder
 * responder 200 a Meta de inmediato.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly catalog: CatalogService,
    private readonly medios: MediaEntranteService,
    private readonly respuesta: RespuestaBotService,
  ) {}

  verificarFirma(
    appSecret: string,
    rawBody: Buffer,
    firmaHeader: string | undefined,
  ): boolean {
    if (!firmaHeader?.startsWith('sha256=')) return false;

    const firmaRecibida = Buffer.from(
      firmaHeader.slice('sha256='.length),
      'hex',
    );
    const firmaCalculada = Buffer.from(
      createHmac('sha256', appSecret).update(rawBody).digest('hex'),
      'hex',
    );
    if (firmaRecibida.length !== firmaCalculada.length) return false;
    return timingSafeEqual(firmaRecibida, firmaCalculada);
  }

  procesarWhatsapp(payload: WhatsappWebhookPayload): void {
    this.procesar(parsearWhatsapp(payload));
  }

  procesarMessenger(payload: MessengerWebhookPayload): void {
    this.procesar(parsearMessengerOInstagram(payload, 'messenger'));
  }

  procesarInstagram(payload: MessengerWebhookPayload): void {
    this.procesar(parsearMessengerOInstagram(payload, 'instagram'));
  }

  private procesar(eventos: EventoEntrante[]): void {
    for (const evento of eventos) {
      this.manejarEvento(evento).catch((err) => {
        this.logger.error(
          `Error procesando mensaje de ${evento.canal} (${evento.identificadorExterno}): ${(err as Error).message}`,
        );
      });
    }
  }

  async manejarEvento(evento: EventoEntrante): Promise<void> {
    if (await this.esDuplicado(evento)) return;
    this.registrarAnuncio(evento);

    const carrito = await this.resolverCarrito(evento);
    const textoHistorial = await this.medios.transcribirNota(evento);
    const conversacion = await this.registrarEntrante(evento, textoHistorial);

    if (await this.medios.atenderArchivo(evento, conversacion)) return;
    if (conversacion.estado === 'derivado') {
      this.logger.log(
        `Conversación ya derivada a humano, no se auto-responde — canal=${evento.canal} id=${evento.identificadorExterno}`,
      );
      return;
    }
    await this.respuesta.responder(evento, conversacion, carrito);
  }

  private async esDuplicado(evento: EventoEntrante): Promise<boolean> {
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

  private registrarAnuncio(evento: EventoEntrante): void {
    const anuncio = evento.procedenciaAnuncio;
    if (!anuncio?.esAnuncio) return;
    this.logger.log(
      `Conversación desde anuncio — canal=${evento.canal} id=${evento.identificadorExterno} anuncio_id=${anuncio.anuncioId ?? 'desconocido'} fuente=${anuncio.fuente ?? 'desconocida'}`,
    );
  }

  /** Cruza el carrito del catálogo con la base y arma el texto del pedido. */
  private async resolverCarrito(
    evento: EventoEntrante,
  ): Promise<CarritoValidado | null> {
    if (!evento.carrito) return null;
    const carrito = await this.catalog.resolverCarrito(evento.carrito.items);
    evento.texto = textoCarritoCatalogo(
      carrito.disponibles,
      carrito.noDisponibles,
      evento.carrito.nota,
    );
    return carrito;
  }

  /**
   * Se persiste el mensaje entrante ANTES del corte por `derivado` — si no,
   * el mensaje del cliente se perdía por completo una vez que la
   * conversación ya estaba en manos de una persona.
   */
  private async registrarEntrante(
    evento: EventoEntrante,
    textoHistorial: string,
  ): Promise<ConversacionCompleta> {
    const conversacion = await this.conversaciones.registrarInteraccion(
      evento.canal,
      evento.identificadorExterno,
    );
    this.guardarCtwaClid(evento);
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'entrante',
      textoHistorial,
    );
    return conversacion;
  }

  private guardarCtwaClid(evento: EventoEntrante): void {
    const ctwaClid = evento.procedenciaAnuncio?.ctwaClid;
    if (evento.canal !== 'whatsapp' || !ctwaClid) return;
    // Fire-and-forget: si falla (ej. la columna todavía no existe) no
    // debe tumbar ni demorar la respuesta al cliente — es un dato para
    // medición, no para el bot, y se lee recién al derivar.
    void this.conversaciones
      .guardarCtwaClid(evento.canal, evento.identificadorExterno, ctwaClid)
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo guardar el ctwa_clid de ${evento.identificadorExterno}: ${err.message}`,
        ),
      );
  }
}
