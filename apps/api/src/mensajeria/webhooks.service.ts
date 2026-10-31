import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CatalogService,
  type ItemCarritoResuelto,
} from '../catalog/catalog.service';
import { GeminiService } from './gemini.service';
import { MetaGraphService } from './meta-graph.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { ComprobantesService } from './comprobantes.service';
import { esSaludoOIntencionDePedir } from './checkout-whatsapp';
import { ConversacionesService } from './conversaciones.service';
import {
  parsearMessengerOInstagram,
  parsearWhatsapp,
  textoCarritoCatalogo,
  type EventoEntrante,
  type MessengerWebhookPayload,
  type WhatsappWebhookPayload,
} from './parseo-webhook';

// Respuesta fija cuando llega algo que el bot no sabe leer.
const MENSAJE_SOLO_TEXTO =
  'Por ahora solo puedo leer mensajes de texto 🙏 ¿Me lo escribís?';
const MENSAJE_AUDIO_NO_ENTENDIDO =
  'No pude escuchar bien tu audio 🙏 ¿Me lo escribís?';

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
    private readonly gemini: GeminiService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
    private readonly catalog: CatalogService,
    private readonly checkout: CheckoutWhatsappService,
    private readonly comprobantes: ComprobantesService,
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

  private async manejarEvento(evento: EventoEntrante): Promise<void> {
    if (evento.mensajeId) {
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
        return;
      }
    }

    if (evento.procedenciaAnuncio?.esAnuncio) {
      this.logger.log(
        `Conversación desde anuncio — canal=${evento.canal} id=${evento.identificadorExterno} anuncio_id=${evento.procedenciaAnuncio.anuncioId ?? 'desconocido'} fuente=${evento.procedenciaAnuncio.fuente ?? 'desconocida'}`,
      );
    }

    let carritoValidado: {
      disponibles: ItemCarritoResuelto[];
      noDisponibles: number;
    } | null = null;
    if (evento.carrito) {
      carritoValidado = await this.catalog.resolverCarrito(
        evento.carrito.items,
      );
      evento.texto = textoCarritoCatalogo(
        carritoValidado.disponibles,
        carritoValidado.noDisponibles,
        evento.carrito.nota,
      );
    }

    // Nota de voz: se transcribe y sigue como si el cliente lo hubiera
    // escrito. En el historial queda con 🎤 para que el equipo lo sepa.
    let textoHistorial = evento.texto;
    if (evento.canal === 'whatsapp' && evento.media?.tipo === 'audio') {
      const transcripcion = await this.transcribir(evento.media.id);
      if (transcripcion) {
        evento.texto = transcripcion;
        evento.media = undefined;
        textoHistorial = `🎤 ${transcripcion}`;
      }
    }

    const conversacion = await this.conversaciones.registrarInteraccion(
      evento.canal,
      evento.identificadorExterno,
    );
    const ctwaClid = evento.procedenciaAnuncio?.ctwaClid;
    if (evento.canal === 'whatsapp' && ctwaClid) {
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
    // Se persiste el mensaje entrante ANTES del corte por `derivado` de
    // abajo — si no, el mensaje del cliente se perdía por completo una vez
    // que la conversación ya estaba en manos de una persona.
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'entrante',
      textoHistorial,
    );
    // Foto o PDF: si el cliente tiene un pedido esperando el comprobante de
    // transferencia, se guarda ahí — aunque la conversación esté derivada.
    if (evento.canal === 'whatsapp' && evento.media && evento.mensajeId) {
      if (evento.media.tipo !== 'audio') {
        let guardado = false;
        try {
          guardado = await this.comprobantes.procesar({
            identificadorExterno: evento.identificadorExterno,
            conversacionId: conversacion.id,
            mensajeId: evento.mensajeId,
            mediaId: evento.media.id,
          });
        } catch (err) {
          this.logger.error(
            `No se pudo procesar el archivo de ${evento.identificadorExterno}: ${(err as Error).message}`,
          );
        }
        if (guardado || conversacion.estado === 'derivado') return;
      } else if (conversacion.estado === 'derivado') {
        return;
      }
      const respuesta =
        evento.media.tipo === 'audio'
          ? MENSAJE_AUDIO_NO_ENTENDIDO
          : MENSAJE_SOLO_TEXTO;
      await this.metaGraph.enviarMensajeSesion(
        evento.canal,
        evento.identificadorExterno,
        respuesta,
      );
      await this.conversaciones.registrarMensaje(
        conversacion.id,
        'saliente_bot',
        respuesta,
      );
      return;
    }

    if (conversacion.estado === 'derivado') {
      this.logger.log(
        `Conversación ya derivada a humano, no se auto-responde — canal=${evento.canal} id=${evento.identificadorExterno}`,
      );
      return;
    }
    // Solo cuando el bot va a responder: Meta pide no mostrar "escribiendo…"
    // si no va a llegar una respuesta.
    if (evento.canal === 'whatsapp' && evento.mensajeId) {
      this.metaGraph.marcarLeidoEscribiendo(evento.mensajeId);
    }

    // Checkout determinístico por botones: carrito, toques, ubicación y
    // las respuestas de cada paso no pasan por Gemini.
    if (evento.canal === 'whatsapp') {
      const ctx = {
        identificadorExterno: evento.identificadorExterno,
        conversacionId: conversacion.id,
        mensajeId: evento.mensajeId,
      };
      if (carritoValidado) {
        await this.checkout.iniciar(
          ctx,
          carritoValidado.disponibles,
          carritoValidado.noDisponibles,
          evento.carrito?.nota ?? null,
        );
        return;
      }
      const entrada = evento.entrada ?? {
        tipo: 'texto' as const,
        texto: evento.texto,
      };
      if (await this.checkout.manejar(ctx, entrada)) return;
      if (
        !evento.entrada &&
        esSaludoOIntencionDePedir(evento.texto) &&
        !(await this.conversaciones.obtenerUltimaInteraccionGemini(
          evento.canal,
          evento.identificadorExterno,
        )) &&
        (await this.checkout.ofrecerLoMismo(ctx))
      ) {
        return;
      }
    }

    const respuesta = await this.gemini.responder(
      evento.canal,
      evento.identificadorExterno,
      evento.telefono,
      evento.texto,
      conversacion.id,
    );
    // null = la herramienta (ej. el botón de catálogo) ya mandó el mensaje
    // y ya lo dejó registrado ella misma (ver gemini.service.ts).
    if (respuesta === null) return;
    await this.metaGraph.enviarMensajeSesion(
      evento.canal,
      evento.identificadorExterno,
      respuesta,
    );
    await this.conversaciones.registrarMensaje(
      conversacion.id,
      'saliente_bot',
      respuesta,
    );
  }

  private async transcribir(mediaId: string): Promise<string | null> {
    try {
      const audio = await this.metaGraph.descargarMedia(mediaId);
      return await this.gemini.transcribirAudio(audio.datos, audio.mime);
    } catch (err) {
      this.logger.warn(
        `No se pudo descargar el audio ${mediaId}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
