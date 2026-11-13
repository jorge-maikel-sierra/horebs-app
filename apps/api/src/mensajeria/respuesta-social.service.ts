import { Injectable } from '@nestjs/common';
import { CheckoutEnviosService } from './checkout-envios.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import type { ConversacionCompleta } from './conversaciones.tipos';
import { DerivacionBotService } from './derivacion-bot.service';
import {
  BOTON_SOCIAL,
  BOTONES_INICIO,
  PREFIJO_CATEGORIA,
} from './opciones-social';
import type { EventoEntrante } from './parseo-webhook';
import { PedidoSocialService } from './pedido-social.service';
import {
  MENSAJE_HUMANO,
  detectarIntencion,
  textoDeIntencion,
  type IntencionFija,
} from './respuestas-fijas';
import { VitrinaSocialService } from './vitrina-social.service';

const INTENCION_DE_BOTON = new Map<string, IntencionFija>([
  [BOTON_SOCIAL.menu, 'menu'],
  [BOTON_SOCIAL.pedir, 'pedir'],
  [BOTON_SOCIAL.horario, 'horario'],
  [BOTON_SOCIAL.descuento, 'descuento'],
  [BOTON_SOCIAL.humano, 'humano'],
]);

const PEDIR_PRODUCTO = /^quiero pedir (.+)$/i;

/**
 * Cómo atiende el bot a un cliente de Messenger o Instagram sin pasar por el
 * modelo: botones del pedido, categorías, menú de inicio y las preguntas que
 * más se repiten (descuento, horario, ubicación, domicilio, precios…). Lo que
 * no reconoce lo deja pasar (false) y responde Gemini.
 */
@Injectable()
export class RespuestaSocialService {
  constructor(
    private readonly envios: CheckoutEnviosService,
    private readonly pedido: PedidoSocialService,
    private readonly vitrina: VitrinaSocialService,
    private readonly derivacion: DerivacionBotService,
  ) {}

  /** true si el mensaje ya quedó atendido. */
  async atender(
    evento: EventoEntrante,
    conversacion: ConversacionCompleta,
  ): Promise<boolean> {
    const ctx: ContextoCheckout = {
      canal: evento.canal,
      identificadorExterno: evento.identificadorExterno,
      conversacionId: conversacion.id,
      mensajeId: evento.mensajeId,
      telefono: evento.telefono ?? conversacion.telefono ?? null,
    };
    if (evento.entrada?.tipo === 'boton') {
      return this.atenderBoton(ctx, evento.entrada.id);
    }
    const producto = PEDIR_PRODUCTO.exec(evento.texto.trim());
    if (producto && (await this.pedido.iniciarProducto(ctx, producto[1]))) {
      return true;
    }
    const intencion = detectarIntencion(evento.texto);
    if (!intencion) return false;
    await this.responder(ctx, intencion, evento.texto);
    return true;
  }

  private async atenderBoton(
    ctx: ContextoCheckout,
    id: string,
  ): Promise<boolean> {
    if (id.startsWith(PREFIJO_CATEGORIA)) {
      return this.vitrina.mostrarCategoria(
        ctx,
        id.slice(PREFIJO_CATEGORIA.length),
      );
    }
    if (id === BOTON_SOCIAL.mas) {
      await this.vitrina.enviarMenu(ctx, false);
      return true;
    }
    const intencion = INTENCION_DE_BOTON.get(id);
    if (intencion) {
      await this.responder(ctx, intencion, '');
      return true;
    }
    return this.pedido.atenderBoton(ctx, id);
  }

  private async responder(
    ctx: ContextoCheckout,
    intencion: IntencionFija,
    texto: string,
  ): Promise<void> {
    if (intencion === 'humano') return this.pasarAUnaPersona(ctx);
    if (intencion === 'menu') return this.vitrina.enviarMenu(ctx, false);
    if (intencion === 'pedir') return this.vitrina.enviarMenu(ctx, true);
    if (intencion === 'precios') return this.vitrina.precios(ctx, texto);
    const respuesta = textoDeIntencion(intencion, new Date());
    if (respuesta) {
      await this.envios.textoConOpciones(ctx, respuesta, BOTONES_INICIO);
    }
  }

  private async pasarAUnaPersona(ctx: ContextoCheckout): Promise<void> {
    await this.derivacion.derivar({
      canal: ctx.canal ?? 'messenger',
      identificadorExterno: ctx.identificadorExterno,
      telefono: ctx.telefono ?? null,
      conversacionId: ctx.conversacionId,
    });
    await this.envios.texto(ctx, MENSAJE_HUMANO);
  }
}
