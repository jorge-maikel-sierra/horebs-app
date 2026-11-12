import { Injectable, Logger } from '@nestjs/common';
import { CheckoutEnviosService } from './checkout-envios.service';
import { textoConfirmacionPedido } from './confirmacion-pedido';
import type { ContextoCheckout, MetodoPagoBot } from './checkout-whatsapp';
import { ConversionesSocialService } from './conversiones-social.service';
import { OrigenConversacionService } from './origen-conversacion.service';
import { PagoBoldService } from './pago-bold.service';

/**
 * Lo que el cliente recibe al terminar el checkout: la confirmación del pedido
 * y, si paga con tarjeta, el enlace de Bold para cobrarlo en el momento. El
 * pedido queda marcado con el anuncio o enlace del que llegó el cliente.
 */
@Injectable()
export class ConfirmacionPedidoService {
  private readonly logger = new Logger(ConfirmacionPedidoService.name);

  constructor(
    private readonly envios: CheckoutEnviosService,
    private readonly pagoBold: PagoBoldService,
    private readonly origenes: OrigenConversacionService,
    private readonly conversiones: ConversionesSocialService,
  ) {}

  /** Cierra el checkout y confirma. Devuelve true si el cobro quedó pendiente de pago. */
  async confirmar(
    ctx: ContextoCheckout,
    datos: {
      nombre: string | undefined;
      pedido: { id: string; total: number };
      programadoPara: string | null | undefined;
      metodo: MetodoPagoBot;
    },
  ): Promise<boolean> {
    this.vincularOrigen(ctx, datos.pedido.id);
    this.conversiones.avisarPedido('OrderCreated', {
      canal: ctx.canal ?? 'whatsapp',
      identificadorExterno: ctx.identificadorExterno,
      pedidoId: datos.pedido.id,
      total: datos.pedido.total,
    });
    await this.envios.limpiar(ctx);
    const enlacePago =
      datos.metodo === 'tarjeta'
        ? await this.pagoBold.iniciarCobro(
            datos.pedido,
            ctx.canal ?? 'whatsapp',
          )
        : null;
    await this.envios.texto(
      ctx,
      textoConfirmacionPedido({ ...datos, enlacePago }),
    );
    return Boolean(enlacePago);
  }

  /** Fire-and-forget: es un dato para medir; no debe frenar la confirmación. */
  private vincularOrigen(ctx: ContextoCheckout, pedidoId: string): void {
    void this.origenes
      .vincularPedido(
        ctx.canal ?? 'whatsapp',
        ctx.identificadorExterno,
        pedidoId,
      )
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo copiar el origen al pedido ${pedidoId}: ${err.message}`,
        ),
      );
  }

  async noSePudoRegistrar(ctx: ContextoCheckout): Promise<void> {
    await this.envios.texto(
      ctx,
      'No pude registrar tu pedido 😕 Ya le avisé al equipo y una persona te escribe por acá en un momento.',
    );
  }
}
