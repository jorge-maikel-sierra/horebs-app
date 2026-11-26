import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { ConversionesWebService } from '../mensajeria/conversiones-web.service';
import type { PedidoAdminDto } from './pedidos-admin.tipos';

/**
 * Pedido del sitio web entregado: el Purchase del servidor a Meta y el
 * correo que le pide la reseña en Google. El cliente web no tiene chat con
 * el bot, así que el correo es la única vía (el checkout lo pide).
 */
@Injectable()
export class EntregaWebService {
  constructor(
    private readonly conversionesWeb: ConversionesWebService,
    private readonly mail: MailService,
  ) {}

  avisarEntrega(pedido: PedidoAdminDto): void {
    this.conversionesWeb.avisarCompra(pedido.id);
    const correo = pedido.cliente.correo?.trim();
    if (!correo) return;
    this.mail.enviarInvitacionResena({
      correo,
      nombre: pedido.cliente.nombre,
      pedidoId: pedido.id,
    });
  }
}
