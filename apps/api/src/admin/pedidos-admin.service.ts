import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { InventarioService } from '../inventario/inventario.service';
import { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import { AvisosPedidoService } from '../mensajeria/avisos-pedido.service';
import { FacturaService } from '../facturas/factura.service';
import { METODOS_PAGO, type MetodoPago } from '../common/metodos-pago';
import { errorDeBase } from '../common/error-de-base';
import { calcularItemsVenta } from './calcular-items-venta';
import { itemsConVariante } from './items-stock';
import { mapPedido } from './pedido-admin.mapper';
import {
  ESTADOS_PEDIDO,
  PEDIDO_ADMIN_SELECT,
  type ItemVentaInput,
  type PedidoAdminDto,
} from './pedidos-admin.tipos';

/** Panel de pedidos: listar, editar (método, estado, ítems), borrar y facturar. */
@Injectable()
export class PedidosAdminService {
  private readonly logger = new Logger(PedidosAdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly inventario: InventarioService,
    private readonly conversionesMeta: ConversionesMetaService,
    private readonly avisosPedido: AvisosPedidoService,
    private readonly factura: FacturaService,
  ) {}

  private async revertirStockSeguro(
    items: { variante_id: string; cantidad: number }[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    try {
      await this.inventario.revertirPorVenta(items, pedidoId, usuarioId);
    } catch (err) {
      this.logger.error(
        `No se pudo revertir stock para el pedido ${pedidoId}: ${(err as Error).message}`,
      );
    }
  }

  async obtenerPedido(id: string): Promise<PedidoAdminDto> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('Pedido no encontrado.');
    return mapPedido(data);
  }

  async generarFacturaPdf(
    id: string,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const pedido = await this.obtenerPedido(id);
    const buffer = await this.factura.generarPdf(pedido);
    return { buffer, nombreArchivo: this.factura.nombreArchivo(pedido) };
  }

  async listarPedidos(): Promise<PedidoAdminDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw errorDeBase(error);
    return (data ?? []).map((p) => mapPedido(p));
  }

  async editarPedido(
    id: string,
    cambios: {
      metodo_pago?: string;
      estado?: string;
      items?: ItemVentaInput[];
    },
    usuarioId: string,
  ): Promise<PedidoAdminDto> {
    if (
      cambios.metodo_pago !== undefined &&
      !METODOS_PAGO.includes(cambios.metodo_pago as MetodoPago)
    ) {
      throw new BadRequestException('Método de pago inválido.');
    }
    if (
      cambios.estado !== undefined &&
      !ESTADOS_PEDIDO.includes(cambios.estado)
    ) {
      throw new BadRequestException('Estado inválido.');
    }

    const client = this.supabase.getClient();

    const { data: pedidoActual, error: pedidoError } = await client
      .from('pedidos')
      .select(
        'id, costo_domicilio, estado, items_pedido(variante_id, cantidad)',
      )
      .eq('id', id)
      .maybeSingle();
    if (pedidoError) throw errorDeBase(pedidoError);
    if (!pedidoActual) throw new NotFoundException('Pedido no encontrado.');

    const itemsActuales = itemsConVariante(pedidoActual.items_pedido ?? []);

    const cancelando =
      cambios.estado === 'cancelado' && pedidoActual.estado !== 'cancelado';

    const payload: Record<string, string | number> = {};
    if (cambios.metodo_pago !== undefined) {
      payload.metodo_pago = cambios.metodo_pago;
    }
    if (cambios.estado !== undefined) {
      payload.estado = cambios.estado;
    }

    if (cambios.items !== undefined) {
      // Se reemplazan los items: primero se revierte el stock de los
      // viejos (siempre), y solo se aplica el de los nuevos si el
      // pedido no está siendo cancelado en la misma llamada.
      if (itemsActuales.length > 0) {
        await this.revertirStockSeguro(itemsActuales, id, usuarioId);
      }

      const { itemsCalculados, total: totalItems } = await calcularItemsVenta(
        client,
        cambios.items,
      );

      const { error: deleteError } = await client
        .from('items_pedido')
        .delete()
        .eq('pedido_id', id);
      if (deleteError) throw errorDeBase(deleteError);

      const { error: insertError } = await client.from('items_pedido').insert(
        itemsCalculados.map((i) => ({
          pedido_id: id,
          variante_id: i.variante_id,
          nombre_personalizado: i.nombre_personalizado,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.subtotal,
        })),
      );
      if (insertError) throw errorDeBase(insertError);

      payload.total = totalItems + (pedidoActual.costo_domicilio ?? 0);

      if (!cancelando) {
        await this.inventario.descontarPorVentaSeguro(
          itemsConVariante(itemsCalculados),
          id,
          usuarioId,
        );
      }
    } else if (cancelando && itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, id, usuarioId);
    }

    if (Object.keys(payload).length > 0) {
      const { error: updateError } = await client
        .from('pedidos')
        .update(payload)
        .eq('id', id);
      if (updateError) throw errorDeBase(updateError);
    }

    // Pedidos del bot: el cliente se entera de cada cambio por WhatsApp.
    // AvisosPedidoService ignora solo los de otros canales.
    if (
      cambios.estado !== undefined &&
      cambios.estado !== pedidoActual.estado
    ) {
      this.avisosPedido.notificarEstado(id);
    }

    const { data: actualizado, error: obtenerError } = await client
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .eq('id', id)
      .single();
    if (obtenerError) throw errorDeBase(obtenerError);
    const pedido = mapPedido(actualizado);

    // Purchase a Meta (Click-to-WhatsApp) al entregar, no al crear: un
    // pedido del bot cancelado no es una venta. Mismo envío idempotente que
    // las ventas del POS; si el cliente no llegó por un anuncio, no sale.
    if (
      cambios.estado === 'entregado' &&
      pedidoActual.estado !== 'entregado' &&
      pedido.canal === 'whatsapp'
    ) {
      this.conversionesMeta.avisarCompra({
        telefono: pedido.cliente.telefono,
        pedidoId: id,
        total: pedido.total,
      });
    }
    return pedido;
  }

  async eliminarPedido(id: string, usuarioId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .select('id, items_pedido(variante_id, cantidad)')
      .eq('id', id)
      .maybeSingle();
    if (pedidoError) throw errorDeBase(pedidoError);
    if (!pedido) throw new NotFoundException('Pedido no encontrado.');

    const itemsActuales = itemsConVariante(pedido.items_pedido ?? []);

    // items_pedido tiene ON DELETE CASCADE hacia pedidos — se borran solos.
    const { error, count } = await client
      .from('pedidos')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException('Pedido no encontrado.');

    if (itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, id, usuarioId);
    }
  }
}
