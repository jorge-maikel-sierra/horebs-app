import { Injectable } from '@nestjs/common';
import type { ItemCarritoResuelto } from '../catalog/catalog.service';
import { esSaludoOIntencionDePedir } from './checkout-whatsapp';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { ConversacionesService } from './conversaciones.service';
import type { ConversacionCompleta } from './conversaciones.tipos';
import { GeminiService } from './gemini.service';
import { MetaGraphService } from './meta-graph.service';
import type { EventoEntrante } from './parseo-webhook';

/** Carrito del catálogo de WhatsApp ya cruzado con lo que hay en la base. */
export interface CarritoValidado {
  disponibles: ItemCarritoResuelto[];
  noDisponibles: number;
}

/**
 * Cómo responde el bot a un mensaje que sí le toca: primero el checkout
 * determinístico por botones (WhatsApp) y, si no aplica, Gemini.
 */
@Injectable()
export class RespuestaBotService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
    private readonly checkout: CheckoutWhatsappService,
  ) {}

  async responder(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
    carrito: CarritoValidado | null,
  ): Promise<void> {
    // Solo cuando el bot va a responder: Meta pide no mostrar "escribiendo…"
    // si no va a llegar una respuesta.
    if (evento.canal === 'whatsapp' && evento.mensajeId) {
      this.metaGraph.marcarLeidoEscribiendo(evento.mensajeId);
    }
    if (
      evento.canal === 'whatsapp' &&
      (await this.checkoutPorBotones(evento, conversacion, carrito))
    ) {
      return;
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

  /**
   * Checkout determinístico: carrito, toques, ubicación y las respuestas de
   * cada paso no pasan por Gemini. true = el checkout ya atendió el evento.
   */
  private async checkoutPorBotones(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
    carrito: CarritoValidado | null,
  ): Promise<boolean> {
    const ctx = {
      identificadorExterno: evento.identificadorExterno,
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
    return (
      !evento.entrada &&
      esSaludoOIntencionDePedir(evento.texto) &&
      !(await this.conversaciones.obtenerUltimaInteraccionGemini(
        evento.canal,
        evento.identificadorExterno,
      )) &&
      (await this.checkout.ofrecerLoMismo(ctx))
    );
  }
}
