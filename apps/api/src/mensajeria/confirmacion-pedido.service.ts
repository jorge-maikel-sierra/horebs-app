import { Injectable } from '@nestjs/common';
import { CheckoutEnviosService } from './checkout-envios.service';
import { textoConfirmacionPedido } from './confirmacion-pedido';
import type { ContextoCheckout, MetodoPagoBot } from './checkout-whatsapp';
import { PagoBoldService } from './pago-bold.service';

/**
 * Lo que el cliente recibe al terminar el checkout: la confirmación del pedido
 * y, si paga con tarjeta, el enlace de Bold para cobrarlo en el momento.
 */
@Injectable()
export class ConfirmacionPedidoService {
  constructor(
    private readonly envios: CheckoutEnviosService,
    private readonly pagoBold: PagoBoldService,
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
    await this.envios.limpiar(ctx);
    const enlacePago =
      datos.metodo === 'tarjeta'
        ? await this.pagoBold.iniciarCobro(datos.pedido)
        : null;
    await this.envios.texto(
      ctx,
      textoConfirmacionPedido({ ...datos, enlacePago }),
    );
    return Boolean(enlacePago);
  }

  async noSePudoRegistrar(ctx: ContextoCheckout): Promise<void> {
    await this.envios.texto(
      ctx,
      'No pude registrar tu pedido 😕 Ya le avisé al equipo y una persona te escribe por acá en un momento.',
    );
  }
}
