import { Injectable } from '@nestjs/common';
import type { ContextoCheckout } from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
} from './conversaciones.service';
import type { BotonRespuesta } from './mensajes-interactivos';
import { MetaGraphService } from './meta-graph.service';

/**
 * Lo que el checkout le manda al cliente por WhatsApp y cómo deja el hilo:
 * cada mensaje saliente se registra en la conversación, y el estado del
 * checkout (y el carrito) se guarda o se limpia acá.
 */
@Injectable()
export class CheckoutEnviosService {
  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  async texto(ctx: ContextoCheckout, texto: string): Promise<void> {
    await this.metaGraph.enviarMensajeSesion(
      'whatsapp',
      ctx.identificadorExterno,
      texto,
    );
    await this.registrar(ctx, texto);
  }

  async botones(
    ctx: ContextoCheckout,
    cuerpo: string,
    botones: BotonRespuesta[],
  ): Promise<void> {
    await this.metaGraph.enviarBotones(
      ctx.identificadorExterno,
      cuerpo,
      botones,
    );
    await this.registrar(ctx, conOpciones(cuerpo, botones));
  }

  async lista(
    ctx: ContextoCheckout,
    cuerpo: string,
    boton: string,
    filas: BotonRespuesta[],
  ): Promise<void> {
    await this.metaGraph.enviarLista(ctx.identificadorExterno, {
      cuerpo,
      boton,
      filas,
    });
    await this.registrar(ctx, conOpciones(cuerpo, filas));
  }

  async pedirUbicacion(ctx: ContextoCheckout, cuerpo: string): Promise<void> {
    await this.metaGraph.pedirUbicacion(ctx.identificadorExterno, cuerpo);
    await this.registrar(ctx, cuerpo);
  }

  async catalogo(ctx: ContextoCheckout, urlFallback: string): Promise<void> {
    await this.metaGraph.enviarCatalogo(
      'whatsapp',
      ctx.identificadorExterno,
      urlFallback,
    );
    await this.registrar(ctx, 'Menú enviado como catálogo de WhatsApp.');
  }

  async guardar(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    await this.conversaciones.guardarCheckout(
      'whatsapp',
      ctx.identificadorExterno,
      checkout,
    );
  }

  /** Cierra el checkout: borra el paso en curso y el carrito pendiente. */
  async limpiar(ctx: ContextoCheckout): Promise<void> {
    await this.conversaciones.guardarCheckout(
      'whatsapp',
      ctx.identificadorExterno,
      null,
    );
    await this.conversaciones.guardarCarrito(
      'whatsapp',
      ctx.identificadorExterno,
      null,
    );
  }

  private async registrar(ctx: ContextoCheckout, texto: string): Promise<void> {
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      texto,
    );
  }
}

/** El texto con los títulos de los botones, tal como queda en el historial. */
function conOpciones(cuerpo: string, opciones: BotonRespuesta[]): string {
  return `${cuerpo}\n[${opciones.map((o) => o.titulo).join(' · ')}]`;
}
