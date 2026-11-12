import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { CatalogService } from '../catalog/catalog.service';
import { ColaPorClave } from './cola-por-clave';
import { MediaEntranteService } from './media-entrante.service';
import {
  parsearMessengerOInstagram,
  parsearReferidosSociales,
  parsearWhatsapp,
  textoCarritoCatalogo,
  type EventoEntrante,
  type MessengerWebhookPayload,
  type ReferidoSocial,
  type WhatsappWebhookPayload,
} from './parseo-webhook';
import { RegistroEntranteService } from './registro-entrante.service';
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
  // Los mensajes de un mismo cliente se atienden de a uno: ver ColaPorClave.
  private readonly cola = new ColaPorClave();

  constructor(
    private readonly registro: RegistroEntranteService,
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

  procesarMessenger(
    payload: MessengerWebhookPayload,
    expectedPageId?: string,
  ): void {
    this.procesar(
      parsearMessengerOInstagram(payload, 'messenger', expectedPageId),
    );
    this.procesarReferidos(
      parsearReferidosSociales(payload, 'messenger', expectedPageId),
    );
  }

  procesarInstagram(
    payload: MessengerWebhookPayload,
    expectedInstagramId?: string,
  ): void {
    this.procesar(
      parsearMessengerOInstagram(payload, 'instagram', expectedInstagramId),
    );
    this.procesarReferidos(
      parsearReferidosSociales(payload, 'instagram', expectedInstagramId),
    );
  }

  /** Van por la misma cola que los mensajes para no cruzarse con ellos. */
  private procesarReferidos(referidos: ReferidoSocial[]): void {
    for (const referido of referidos) {
      const clave = `${referido.canal}:${referido.identificadorExterno}`;
      this.cola
        .ejecutar(clave, () => this.registro.registrarReferido(referido))
        .catch((err) => {
          this.logger.error(
            `Error guardando el origen de ${referido.canal} (${referido.identificadorExterno}): ${(err as Error).message}`,
          );
        });
    }
  }

  private procesar(eventos: EventoEntrante[]): void {
    for (const evento of eventos) {
      const clave = `${evento.canal}:${evento.identificadorExterno}`;
      this.cola
        .ejecutar(clave, () => this.manejarEvento(evento))
        .catch((err) => {
          this.logger.error(
            `Error procesando mensaje de ${evento.canal} (${evento.identificadorExterno}): ${(err as Error).message}`,
          );
        });
    }
  }

  async manejarEvento(evento: EventoEntrante): Promise<void> {
    if (await this.registro.esDuplicado(evento)) return;

    const carrito = await this.resolverCarrito(evento);
    const textoHistorial = await this.medios.transcribirNota(evento);
    const conversacion = await this.registro.registrar(evento, textoHistorial);

    if (await this.medios.atenderArchivo(evento, conversacion)) return;
    if (conversacion.estado === 'derivado') {
      this.logger.log(
        `Conversación ya derivada a humano, no se auto-responde — canal=${evento.canal} id=${evento.identificadorExterno}`,
      );
      return;
    }
    await this.respuesta.responder(evento, conversacion, carrito);
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
}
