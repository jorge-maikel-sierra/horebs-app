import { Injectable } from '@nestjs/common';
import { obtenerCapacidades } from './capacidades-canal';
import type { ContextoCheckout } from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
  type ItemCarritoPendiente,
} from './conversaciones.service';
import { ConversionesSocialService } from './conversiones-social.service';
import type { EventoConversacion } from './conversiones-social';
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
    private readonly conversiones: ConversionesSocialService,
  ) {}

  async texto(ctx: ContextoCheckout, texto: string): Promise<void> {
    await this.metaGraph.enviarMensajeSesion(
      ctx.canal ?? 'whatsapp',
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
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
      cuerpo,
      botones,
    );
    await this.registrar(ctx, conOpciones(cuerpo, botones));
  }

  /**
   * Texto con opciones rápidas. Si el texto no cabe en un solo mensaje del
   * canal (Instagram admite 1000 bytes), va aparte y las opciones en uno corto.
   */
  async textoConOpciones(
    ctx: ContextoCheckout,
    texto: string,
    opciones: BotonRespuesta[],
  ): Promise<void> {
    const canal = ctx.canal ?? 'whatsapp';
    const limite = obtenerCapacidades(canal).maxBytesTexto;
    if (Buffer.byteLength(texto, 'utf8') <= limite) {
      await this.botones(ctx, texto, opciones);
      return;
    }
    await this.texto(ctx, texto);
    await this.botones(ctx, '¿Qué quieres hacer?', opciones);
  }

  async lista(
    ctx: ContextoCheckout,
    cuerpo: string,
    boton: string,
    filas: BotonRespuesta[],
  ): Promise<void> {
    await this.metaGraph.enviarLista(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
      {
        cuerpo,
        boton,
        filas,
      },
    );
    await this.registrar(ctx, conOpciones(cuerpo, filas));
  }

  async catalogo(ctx: ContextoCheckout, urlFallback: string): Promise<void> {
    const canal = ctx.canal ?? 'whatsapp';
    await this.metaGraph.enviarCatalogo(
      canal,
      ctx.identificadorExterno,
      urlFallback,
    );
    await this.registrar(
      ctx,
      canal === 'whatsapp'
        ? 'Menú enviado como catálogo de WhatsApp.'
        : 'Menú enviado.',
    );
  }

  /** El checkout en curso del cliente, o null si no tiene uno. */
  obtener(ctx: ContextoCheckout): Promise<CheckoutWhatsapp | null> {
    return this.conversaciones.obtenerCheckout(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
    );
  }

  async guardarCarrito(
    ctx: ContextoCheckout,
    items: ItemCarritoPendiente[],
  ): Promise<void> {
    await this.conversaciones.guardarCarrito(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
      items,
    );
    if (items.length > 0) this.avisarMeta(ctx, 'AddToCart');
  }

  /** Paso del embudo para la API de conversiones (solo Messenger e Instagram). */
  avisarMeta(ctx: ContextoCheckout, evento: EventoConversacion): void {
    this.conversiones.avisarConversacion(
      evento,
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
    );
  }

  /** Cuándo se le mandó la oferta del 10% (null si nunca). */
  ofertaEnviadaEn(ctx: ContextoCheckout): Promise<string | null> {
    return this.conversaciones.obtenerOfertaEnviada(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
    );
  }

  async guardar(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    await this.conversaciones.guardarCheckout(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
      checkout,
    );
  }

  async guardarTelefono(
    ctx: ContextoCheckout,
    telefono: string,
  ): Promise<void> {
    await this.conversaciones.guardarTelefono(
      ctx.canal ?? 'whatsapp',
      ctx.identificadorExterno,
      telefono,
    );
  }

  /** Cierra el checkout: borra el paso en curso y el carrito pendiente. */
  async limpiar(ctx: ContextoCheckout): Promise<void> {
    const canal = ctx.canal ?? 'whatsapp';
    await this.conversaciones.guardarCheckout(
      canal,
      ctx.identificadorExterno,
      null,
    );
    await this.conversaciones.guardarCarrito(
      canal,
      ctx.identificadorExterno,
      null,
    );
  }

  /** Deja en el historial de la conversación lo que se le mandó al cliente. */
  async registrar(ctx: ContextoCheckout, texto: string): Promise<void> {
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
