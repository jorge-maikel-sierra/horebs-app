import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InsumosService } from './insumos.service';
import { errorDeBase } from '../common/error-de-base';
import {
  comoSalida,
  explotarRecetas,
  paramsMovimientosPedido,
} from './inventario-reglas';
import {
  RECETA_EXPLOSION_SELECT,
  type FilaRecetaExplosion,
  type ItemVendido,
  type MovimientoCalculado,
  type TipoMovimientoPedido,
} from './inventario.tipos';

export type * from './inventario.tipos';

/**
 * Explota ventas (variante × cantidad) contra sus recetas y aplica los
 * movimientos de stock resultantes. Compartido entre el checkout web
 * (PedidosService) y el POS (VentasService).
 */
@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly insumos: InsumosService,
  ) {}

  async calcularExplosion(
    items: ItemVendido[],
  ): Promise<MovimientoCalculado[]> {
    const varianteIds = [...new Set(items.map((i) => i.variante_id))];
    if (varianteIds.length === 0) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('recetas')
      .select(RECETA_EXPLOSION_SELECT)
      .in('variante_id', varianteIds)
      .eq('activa', true)
      .returns<FilaRecetaExplosion[]>();
    if (error) throw errorDeBase(error);

    return explotarRecetas(items, data ?? []);
  }

  async descontarPorVenta(
    items: ItemVendido[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    const movimientos = await this.calcularExplosion(items);
    if (movimientos.length === 0) return;
    await this.aplicarMovimientos(
      comoSalida(movimientos),
      pedidoId,
      'venta',
      usuarioId,
    );
  }

  /**
   * Igual que `descontarPorVenta`, pero nunca deja al pedido "huérfano"
   * en silencio: si el descuento falla (ej. la RPC de stock revienta),
   * marca `pedidos.stock_status = 'pendiente'` y avisa por correo — antes
   * el error solo se logueaba y el pedido quedaba confirmado con el
   * inventario real desactualizado, sin que nadie se enterara.
   */
  async descontarPorVentaSeguro(
    items: ItemVendido[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    try {
      await this.descontarPorVenta(items, pedidoId, usuarioId);
    } catch (err) {
      const motivo = (err as Error).message;
      this.logger.error(
        `No se pudo descontar stock para el pedido ${pedidoId}: ${motivo}`,
      );
      await this.marcarStockPendiente(pedidoId);
      this.mail.enviarAlertaStockPendiente({ pedidoId, motivoError: motivo });
    }
  }

  async revertirPorVenta(
    items: ItemVendido[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    const movimientos = await this.calcularExplosion(items);
    if (movimientos.length === 0) return;
    await this.aplicarMovimientos(
      movimientos,
      pedidoId,
      'reversion',
      usuarioId,
    );
  }

  private async marcarStockPendiente(pedidoId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update({ stock_status: 'pendiente' })
      .eq('id', pedidoId);
    if (error) {
      this.logger.error(
        `Encima no se pudo marcar stock_status='pendiente' para ${pedidoId}: ${error.message}`,
      );
    }
  }

  private async aplicarMovimientos(
    movimientos: MovimientoCalculado[],
    pedidoId: string,
    tipo: TipoMovimientoPedido,
    usuarioId: string | null,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .rpc(
        'aplicar_movimientos_stock',
        paramsMovimientosPedido(movimientos, pedidoId, tipo, usuarioId),
      );
    if (error) throw errorDeBase(error);

    // No bloquea la venta si falla — es una alerta, no algo que deba
    // tumbar el checkout.
    this.insumos
      .verificarYAlertarStockBajo(movimientos.map((m) => m.insumo_id))
      .catch((err) =>
        this.logger.error(
          `No se pudo verificar stock bajo tras ${tipo}: ${(err as Error).message}`,
        ),
      );
  }
}
