import { Injectable } from '@nestjs/common';
import type { ItemCarritoResuelto } from '../catalog/catalog.service';
import { AtencionDeterministaService } from './atencion-determinista.service';
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
 * Cómo responde el bot a un mensaje que sí le toca: primero lo determinístico
 * (checkout por botones, pedido por botones y respuestas fijas) y, si no
 * aplica, Gemini.
 */
@Injectable()
export class RespuestaBotService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly metaGraph: MetaGraphService,
    private readonly conversaciones: ConversacionesService,
    private readonly determinista: AtencionDeterministaService,
  ) {}

  async responder(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
    carrito: CarritoValidado | null,
  ): Promise<void> {
    // Solo cuando el bot va a responder: Meta pide no mostrar "escribiendo…"
    // si no va a llegar una respuesta.
    this.metaGraph.marcarLeidoEscribiendo(
      evento.canal,
      evento.identificadorExterno,
      evento.mensajeId ?? undefined,
    );
    if (await this.determinista.atender(evento, conversacion, carrito)) {
      return;
    }

    const respuesta = await this.gemini.responder(
      {
        canal: evento.canal,
        identificadorExterno: evento.identificadorExterno,
        telefono: evento.telefono ?? conversacion.telefono ?? null,
        conversacionId: conversacion.id,
      },
      evento.texto,
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
}
