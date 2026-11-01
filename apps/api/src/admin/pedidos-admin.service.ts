import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { InventarioService } from '../inventario/inventario.service';
import { FacturaService } from '../facturas/factura.service';
import { METODOS_PAGO, type MetodoPago } from '../common/metodos-pago';
import { errorDeBase } from '../common/error-de-base';
import { AvisosCambioPedidoService } from './avisos-cambio-pedido.service';
import { calcularItemsVenta } from './calcular-items-venta';
import { itemsConVariante } from './items-stock';
import { mapPedido } from './pedido-admin.mapper';
import {
  ESTADOS_PEDIDO,
  PEDIDO_ADMIN_SELECT,
  type EditarPedidoInput,
  type FilaPedidoAdmin,
  type FilaPedidoParaEditar,
  type ItemVentaInput,
  type PedidoAdminDto,
} from './pedidos-admin.tipos';

interface ReemplazoDeItems {
  pedidoId: string;
  items: ItemVentaInput[];
  costoDomicilio: number;
  itemsActuales: { variante_id: string; cantidad: number }[];
  cancelando: boolean;
  usuarioId: string;
}

function validarCambios(cambios: EditarPedidoInput): void {
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
}

function payloadDeCambios(
  cambios: EditarPedidoInput,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {};
  if (cambios.metodo_pago !== undefined)
    payload.metodo_pago = cambios.metodo_pago;
  if (cambios.estado !== undefined) payload.estado = cambios.estado;
  return payload;
}

/** Panel de pedidos: listar, editar (método, estado, ítems), borrar y facturar. */
@Injectable()
export class PedidosAdminService {
  private readonly logger = new Logger(PedidosAdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly inventario: InventarioService,
    private readonly avisosCambio: AvisosCambioPedidoService,
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
      .maybeSingle<FilaPedidoAdmin>();
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
      .limit(100)
      .returns<FilaPedidoAdmin[]>();

    if (error) throw errorDeBase(error);
    return (data ?? []).map((p) => mapPedido(p));
  }

  async editarPedido(
    id: string,
    cambios: EditarPedidoInput,
    usuarioId: string,
  ): Promise<PedidoAdminDto> {
    validarCambios(cambios);
    const client = this.supabase.getClient();
    const actual = await this.leerParaEditar(client, id);
    const itemsActuales = itemsConVariante(actual.items_pedido ?? []);
    const cancelando =
      cambios.estado === 'cancelado' && actual.estado !== 'cancelado';

    const payload = payloadDeCambios(cambios);
    if (cambios.items !== undefined) {
      payload.total = await this.reemplazarItems(client, {
        pedidoId: id,
        items: cambios.items,
        costoDomicilio: actual.costo_domicilio ?? 0,
        itemsActuales,
        cancelando,
        usuarioId,
      });
    } else if (cancelando && itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, id, usuarioId);
    }

    await this.actualizarPedido(client, id, payload);
    const pedido = await this.leerPedidoAdmin(client, id);
    this.avisosCambio.avisar(pedido, cambios.estado, actual.estado);
    return pedido;
  }

  private async leerParaEditar(
    client: SupabaseClient,
    id: string,
  ): Promise<FilaPedidoParaEditar> {
    const { data, error } = await client
      .from('pedidos')
      .select(
        'id, costo_domicilio, estado, items_pedido(variante_id, cantidad)',
      )
      .eq('id', id)
      .maybeSingle<FilaPedidoParaEditar>();
    if (error) throw errorDeBase(error);
    if (!data) throw new NotFoundException('Pedido no encontrado.');
    return data;
  }

  private async leerPedidoAdmin(
    client: SupabaseClient,
    id: string,
  ): Promise<PedidoAdminDto> {
    const { data, error } = await client
      .from('pedidos')
      .select(PEDIDO_ADMIN_SELECT)
      .eq('id', id)
      .single<FilaPedidoAdmin>();
    if (error) throw errorDeBase(error);
    return mapPedido(data);
  }

  private async actualizarPedido(
    client: SupabaseClient,
    id: string,
    payload: Record<string, string | number>,
  ): Promise<void> {
    if (Object.keys(payload).length === 0) return;
    const { error } = await client.from('pedidos').update(payload).eq('id', id);
    if (error) throw errorDeBase(error);
  }

  /**
   * Se reemplazan los items: primero se revierte el stock de los viejos
   * (siempre), y solo se aplica el de los nuevos si el pedido no está siendo
   * cancelado en la misma llamada. Devuelve el total nuevo del pedido.
   */
  private async reemplazarItems(
    client: SupabaseClient,
    cambio: ReemplazoDeItems,
  ): Promise<number> {
    const { pedidoId, usuarioId, itemsActuales } = cambio;
    if (itemsActuales.length > 0) {
      await this.revertirStockSeguro(itemsActuales, pedidoId, usuarioId);
    }
    const { itemsCalculados, total } = await calcularItemsVenta(
      client,
      cambio.items,
    );

    const { error: deleteError } = await client
      .from('items_pedido')
      .delete()
      .eq('pedido_id', pedidoId);
    if (deleteError) throw errorDeBase(deleteError);

    const { error: insertError } = await client.from('items_pedido').insert(
      itemsCalculados.map((i) => ({
        pedido_id: pedidoId,
        variante_id: i.variante_id,
        nombre_personalizado: i.nombre_personalizado,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    if (insertError) throw errorDeBase(insertError);

    if (!cambio.cancelando) {
      await this.inventario.descontarPorVentaSeguro(
        itemsConVariante(itemsCalculados),
        pedidoId,
        usuarioId,
      );
    }
    return total + cambio.costoDomicilio;
  }

  async eliminarPedido(id: string, usuarioId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: pedido, error: pedidoError } = await client
      .from('pedidos')
      .select('id, items_pedido(variante_id, cantidad)')
      .eq('id', id)
      .maybeSingle<FilaPedidoParaEditar>();
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
