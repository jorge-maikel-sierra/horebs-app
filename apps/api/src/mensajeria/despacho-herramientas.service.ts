import { Injectable } from '@nestjs/common';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import { CheckoutHistorialService } from './checkout-historial.service';
import type { PasoFunctionCall } from './gemini-cliente.service';
import { HerramientasBotService } from './herramientas-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import { ResumenPedidoBotService } from './resumen-pedido-bot.service';

const LARGO_ID_CORTO = 8;

/**
 * El cliente ya tiene un pedido en curso de esta conversación: el modelo no
 * vuelve a calcularlo (el 21 nov 2026 un "le envío el capture al recibir"
 * terminó en un pedido duplicado).
 */
export function textoPedidoEnCurso(pedidoId: string): string {
  return `NO calcules otro pedido: este cliente ya tiene el pedido #${pedidoId.slice(0, LARGO_ID_CORTO)} en curso, creado hace poco en esta conversación. Si manda el comprobante, pregunta por la demora o da un dato del pedido, contéstale sobre ese pedido sin repetir el resumen. Si quiere cambiarlo, agregarle algo o hacer otro pedido aparte, llama a derivar_a_humano.`;
}

/** Qué hace el bot con cada herramienta que el modelo decide llamar. */
@Injectable()
export class DespachoHerramientasService {
  constructor(
    private readonly herramientas: HerramientasBotService,
    private readonly calculo: CalculoPedidoBotService,
    private readonly resumenes: ResumenPedidoBotService,
    private readonly historial: CheckoutHistorialService,
  ) {}

  /**
   * Texto que se le devuelve al modelo como resultado de la herramienta.
   * `null` cuando `calcular_pedido` ya le mandó el resumen al cliente por
   * su cuenta y no hay nada más que contestar.
   */
  async resultado(
    llamada: PasoFunctionCall,
    ctx: ContextoHerramienta,
    interaccionId: string,
  ): Promise<string | null> {
    if (llamada.name !== 'calcular_pedido') {
      return this.herramientas.ejecutar(llamada.name, llamada.arguments, ctx);
    }
    const enCurso = await this.historial.pedidoEnCurso(ctx.conversacionId);
    if (enCurso) return textoPedidoEnCurso(enCurso);
    const calculo = await this.calculo.calcular(
      llamada.arguments,
      ctx.canal,
      ctx.identificadorExterno,
    );
    if (!calculo.ok) return calculo.texto;
    await this.resumenes.enviar(ctx, calculo, interaccionId, llamada.id);
    return null;
  }

  /** Pasa la conversación a una persona del equipo. */
  derivar(ctx: ContextoHerramienta): Promise<string> {
    return this.herramientas.ejecutar('derivar_a_humano', {}, ctx);
  }
}
