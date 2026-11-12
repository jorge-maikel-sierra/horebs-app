import { Injectable } from '@nestjs/common';
import { AvisosPedidoService } from '../mensajeria/avisos-pedido.service';
import { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import { ConversionesSocialService } from '../mensajeria/conversiones-social.service';
import { ConversionesWebService } from '../mensajeria/conversiones-web.service';
import type { PedidoAdminDto } from './pedidos-admin.tipos';

/**
 * Lo que sale hacia afuera cuando el panel cambia el estado de un pedido.
 * Pedidos del bot: el cliente se entera por WhatsApp (AvisosPedidoService
 * ignora los de otros canales). Y el Purchase a Meta (Click-to-WhatsApp) sale
 * al entregar, no al crear: un pedido del bot cancelado no es una venta. Mismo
 * envío idempotente que las ventas del POS; si el cliente no llegó por un
 * anuncio, no sale. Los pedidos de Messenger e Instagram mandan Purchase al
 * entregar y OrderCanceled al cancelar, ligados al cliente por la conversación.
 * Los del sitio web mandan el Purchase del servidor al entregar.
 */
@Injectable()
export class AvisosCambioPedidoService {
  constructor(
    private readonly avisosPedido: AvisosPedidoService,
    private readonly conversionesMeta: ConversionesMetaService,
    private readonly conversionesSocial: ConversionesSocialService,
    private readonly conversionesWeb: ConversionesWebService,
  ) {}

  avisar(
    pedido: PedidoAdminDto,
    nuevo: string | undefined,
    anterior: string,
  ): void {
    if (nuevo === undefined || nuevo === anterior) return;
    this.avisosPedido.notificarEstado(pedido.id);
    if (nuevo === 'entregado' && pedido.canal === 'whatsapp') {
      this.conversionesMeta.avisarCompra({
        telefono: pedido.cliente.telefono,
        pedidoId: pedido.id,
        total: pedido.total,
      });
    }
    if (nuevo === 'entregado' && pedido.canal === 'web') {
      this.conversionesWeb.avisarCompra(pedido.id);
    }
    if (pedido.canal === 'messenger' || pedido.canal === 'instagram') {
      this.avisarSocial(pedido.id, nuevo);
    }
  }

  private avisarSocial(pedidoId: string, nuevo: string): void {
    if (nuevo === 'entregado') {
      this.conversionesSocial.avisarPedidoPorId('Purchase', pedidoId);
    } else if (nuevo === 'cancelado') {
      this.conversionesSocial.avisarPedidoPorId('OrderCanceled', pedidoId);
    }
  }
}
