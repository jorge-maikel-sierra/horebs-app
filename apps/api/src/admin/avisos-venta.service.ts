import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import type {
  FilaClienteVenta,
  FilaPedidoVenta,
  ItemVentaCalculado,
} from './pedidos-admin.tipos';

/**
 * Lo que sale hacia afuera cuando el POS registra una venta. Ninguno espera ni
 * puede tumbar la venta: el Purchase a Meta (atribuido por teléfono si el
 * cliente llegó por un anuncio Click-to-WhatsApp) y el correo al domiciliario.
 */
@Injectable()
export class AvisosVentaService {
  constructor(
    private readonly mail: MailService,
    private readonly conversionesMeta: ConversionesMetaService,
  ) {}

  avisar(venta: {
    pedido: FilaPedidoVenta;
    cliente: FilaClienteVenta;
    items: ItemVentaCalculado[];
    notas: string | null;
  }): void {
    const { pedido, cliente, items, notas } = venta;
    this.conversionesMeta.avisarCompra({
      telefono: cliente.telefono,
      pedidoId: pedido.id,
      total: Number(pedido.total),
    });

    if (pedido.modalidad !== 'domicilio' || !pedido.direccion_entrega) return;
    this.mail.enviarNotificacionDomicilio({
      pedidoId: pedido.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      direccionEntrega: pedido.direccion_entrega,
      items: items.map((i) => ({
        cantidad: i.cantidad,
        nombre: i.variante_nombre
          ? `${i.producto_nombre} (${i.variante_nombre})`
          : i.producto_nombre,
        precioUnitario: i.precio_unitario,
      })),
      costoDomicilio: pedido.costo_domicilio,
      metodoPago: pedido.metodo_pago,
      total: pedido.total,
      notas,
    });
  }
}
