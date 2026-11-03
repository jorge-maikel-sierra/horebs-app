import { Injectable, Logger } from '@nestjs/common';
import type { ResultadoCalculo } from './calculo-pedido-bot.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { ConversacionesService } from './conversaciones.service';
import { GeminiClienteService } from './gemini-cliente.service';
import type { ContextoHerramienta } from './herramientas-bot.tipos';

type CalculoListo = Extract<ResultadoCalculo, { ok: true }>;

/**
 * El resumen del pedido que calcula `calcular_pedido`: lo manda el sistema
 * (no el modelo) y a Gemini solo se le avisa que ya salió.
 */
@Injectable()
export class ResumenPedidoBotService {
  private readonly logger = new Logger(ResumenPedidoBotService.name);

  constructor(
    private readonly cliente: GeminiClienteService,
    private readonly conversaciones: ConversacionesService,
    private readonly checkout: CheckoutWhatsappService,
  ) {}

  /**
   * Manda el resumen armado por código y le avisa a Gemini que ya se envió.
   * Pasa al checkout con botones (teléfono si falta, hora y pago) en los tres
   * canales: el pedido se crea con un toque, sin que el modelo intervenga y
   * sin sacar al cliente del chat. Lo que Gemini conteste al aviso no se
   * manda al cliente.
   */
  async enviar(
    ctx: ContextoHerramienta,
    calculo: CalculoListo,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    const { canal, identificadorExterno, conversacionId } = ctx;
    const resumen = await this.checkout.ofrecerPagoDesdeCalculo({
      canal,
      telefono: ctx.telefono,
      identificadorExterno,
      conversacionId,
      items: calculo.items,
      checkout: { paso: 'pago', ...calculo.datos },
    });
    this.logger.log(
      `id=${identificadorExterno} herramienta=calcular_pedido → resumen enviado por el sistema`,
    );
    await this.avisarResumen(ctx, resumen, interaccionId, llamadaId);
  }

  /** Le cuenta a Gemini que el sistema ya mandó el resumen; su respuesta no llega al cliente. */
  private async avisarResumen(
    ctx: ContextoHerramienta,
    resumen: string,
    interaccionId: string,
    llamadaId: string,
  ): Promise<void> {
    const { canal, identificadorExterno } = ctx;
    try {
      const aviso = await this.cliente.llamar({
        model: this.cliente.modelo,
        previous_interaction_id: interaccionId,
        input: {
          type: 'function_result',
          call_id: llamadaId,
          name: 'calcular_pedido',
          result: [
            {
              type: 'text',
              text: `El sistema ya le mandó al cliente este resumen y los botones del método de pago — no lo repitas:\n${resumen}\nCuando el cliente elija el método de pago, el sistema crea el pedido solo. Si escribe el método de pago en vez de tocar el botón, también lo toma el sistema.`,
            },
          ],
        },
      });
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        aviso.id,
      );
    } catch (err) {
      // El cliente ya tiene su resumen: si Gemini no responde, se guarda
      // la interacción previa y la conversación sigue igual.
      this.logger.warn(
        `id=${identificadorExterno} no se pudo avisar a Gemini del resumen: ${(err as Error).message}`,
      );
      await this.conversaciones.guardarInteraccionGemini(
        canal,
        identificadorExterno,
        interaccionId,
      );
    }
  }
}
