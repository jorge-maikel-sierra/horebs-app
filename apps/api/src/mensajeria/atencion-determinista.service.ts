import { Injectable } from '@nestjs/common';
import {
  esSaludoOIntencionDePedir,
  type ContextoCheckout,
} from './checkout-whatsapp';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import type { EventoEntrante } from './parseo-webhook';
import type { CarritoValidado } from './respuesta-bot.service';
import { RespuestaSocialService } from './respuesta-social.service';

/**
 * Todo lo que el bot contesta sin pasar por el modelo: primero el checkout
 * por botones (carrito, toques, ubicación y las respuestas de cada paso) y,
 * en Messenger e Instagram, el pedido por botones y las respuestas fijas.
 * true = el mensaje ya quedó atendido; false → responde Gemini.
 */
@Injectable()
export class AtencionDeterministaService {
  constructor(
    private readonly checkout: CheckoutWhatsappService,
    private readonly conversaciones: ConversacionesService,
    private readonly social: RespuestaSocialService,
  ) {}

  async atender(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
    carrito: CarritoValidado | null,
  ): Promise<boolean> {
    if (await this.checkoutPorBotones(evento, conversacion, carrito)) {
      return true;
    }
    if (evento.canal === 'whatsapp') return false;
    return this.social.atender(evento, conversacion);
  }

  private async checkoutPorBotones(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
    carrito: CarritoValidado | null,
  ): Promise<boolean> {
    const ctx = {
      canal: evento.canal,
      identificadorExterno: evento.identificadorExterno,
      telefono: evento.telefono ?? conversacion.telefono ?? null,
      conversacionId: conversacion.id,
      mensajeId: evento.mensajeId,
    };
    if (carrito) {
      await this.checkout.iniciar(
        ctx,
        carrito.disponibles,
        carrito.noDisponibles,
        evento.carrito?.nota ?? null,
      );
      return true;
    }
    const entrada = evento.entrada ?? {
      tipo: 'texto' as const,
      texto: evento.texto,
    };
    if (await this.checkout.manejar(ctx, entrada)) return true;
    return this.intentarOfrecerLoMismo(evento, ctx);
  }

  /** "¿Lo mismo de la última vez?": solo WhatsApp, donde el id del cliente es su teléfono. */
  private async intentarOfrecerLoMismo(
    evento: EventoEntrante,
    ctx: ContextoCheckout,
  ): Promise<boolean> {
    if (
      evento.canal !== 'whatsapp' ||
      evento.entrada ||
      !esSaludoOIntencionDePedir(evento.texto)
    ) {
      return false;
    }
    const ultima = await this.conversaciones.obtenerUltimaInteraccionGemini(
      evento.canal,
      evento.identificadorExterno,
    );
    if (ultima) return false;
    return this.checkout.ofrecerLoMismo(ctx);
  }
}
