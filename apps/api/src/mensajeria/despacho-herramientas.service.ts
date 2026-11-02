import { Injectable } from '@nestjs/common';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import type { PasoFunctionCall } from './gemini-cliente.service';
import { HerramientasBotService } from './herramientas-bot.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';
import { ResumenPedidoBotService } from './resumen-pedido-bot.service';

/** Qué hace el bot con cada herramienta que el modelo decide llamar. */
@Injectable()
export class DespachoHerramientasService {
  constructor(
    private readonly herramientas: HerramientasBotService,
    private readonly calculo: CalculoPedidoBotService,
    private readonly resumenes: ResumenPedidoBotService,
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
