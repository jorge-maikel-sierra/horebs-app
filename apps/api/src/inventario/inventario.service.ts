import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { InsumosService } from './insumos.service';

export interface ItemVendido {
  variante_id: string;
  cantidad: number;
}

interface MovimientoCalculado {
  insumo_id: string;
  cantidad_g: number;
}

interface RecetaComponenteFila {
  tipo_componente: 'insumo' | 'subreceta';
  insumo_id: string | null;
  subreceta_id: string | null;
  cantidad_necesaria_g: number;
  subrecetas: {
    rendimiento_g: number;
    subreceta_componentes: { insumo_id: string; cantidad_necesaria_g: number }[];
  } | null;
}

/**
 * Explota ventas (variante × cantidad) contra sus recetas y aplica los
 * movimientos de stock resultantes. Compartido entre el checkout web
 * (PedidosService) y el POS (AdminService).
 */
@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
    private readonly insumos: InsumosService,
  ) {}

  /**
   * Receta → subreceta → insumo (máximo 2 niveles). Una subreceta se
   * escala por `cantidad_necesaria_g / rendimiento_g` de la subreceta —
   * ej. si la receta pide 100g de una salsa que rinde 1140g por lote,
   * se toma el 100/1140 de cada insumo de esa salsa. Variantes sin
   * receta activa se omiten en silencio: no todos los productos tienen
   * receta cargada todavía.
   */
  async calcularExplosion(items: ItemVendido[]): Promise<MovimientoCalculado[]> {
    const varianteIds = [...new Set(items.map((i) => i.variante_id))];
    if (varianteIds.length === 0) return [];

    const { data: recetas, error } = await this.supabase
      .getClient()
      .from('recetas')
      .select(
        'variante_id, receta_componentes(tipo_componente, insumo_id, subreceta_id, cantidad_necesaria_g, subrecetas(rendimiento_g, subreceta_componentes(insumo_id, cantidad_necesaria_g)))',
      )
      .in('variante_id', varianteIds)
      .eq('activa', true);
    if (error) throw error;

    const recetaPorVariante = new Map(
      (recetas ?? []).map((r: any) => [r.variante_id as string, r]),
    );
    const acumulado = new Map<string, number>();
    const sumar = (insumoId: string, gramos: number) => {
      acumulado.set(insumoId, (acumulado.get(insumoId) ?? 0) + gramos);
    };

    for (const item of items) {
      const receta = recetaPorVariante.get(item.variante_id);
      if (!receta) continue;

      const componentes = (receta.receta_componentes ?? []) as RecetaComponenteFila[];
      for (const comp of componentes) {
        if (comp.tipo_componente === 'insumo' && comp.insumo_id) {
          sumar(comp.insumo_id, comp.cantidad_necesaria_g * item.cantidad);
          continue;
        }
        if (comp.tipo_componente === 'subreceta' && comp.subrecetas) {
          const rendimiento = comp.subrecetas.rendimiento_g;
          if (!rendimiento) continue; // subreceta sin rendimiento cargado, no se puede escalar
          const ratio = (comp.cantidad_necesaria_g / rendimiento) * item.cantidad;
          for (const sub of comp.subrecetas.subreceta_componentes ?? []) {
            sumar(sub.insumo_id, sub.cantidad_necesaria_g * ratio);
          }
        }
      }
    }

    return Array.from(acumulado.entries()).map(([insumo_id, cantidad_g]) => ({
      insumo_id,
      cantidad_g,
    }));
  }

  async descontarPorVenta(
    items: ItemVendido[],
    pedidoId: string,
    usuarioId: string | null,
  ): Promise<void> {
    const movimientos = await this.calcularExplosion(items);
    if (movimientos.length === 0) return;
    await this.aplicarMovimientos(
      movimientos.map((m) => ({ ...m, cantidad_g: -m.cantidad_g })),
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
      this.logger.error(`No se pudo descontar stock para el pedido ${pedidoId}: ${motivo}`);

      const { error: updateError } = await this.supabase
        .getClient()
        .from('pedidos')
        .update({ stock_status: 'pendiente' })
        .eq('id', pedidoId);
      if (updateError) {
        this.logger.error(
          `Encima no se pudo marcar stock_status='pendiente' para ${pedidoId}: ${updateError.message}`,
        );
      }

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
    await this.aplicarMovimientos(movimientos, pedidoId, 'reversion', usuarioId);
  }

  private async aplicarMovimientos(
    movimientos: MovimientoCalculado[],
    pedidoId: string,
    tipo: 'venta' | 'reversion',
    usuarioId: string | null,
  ): Promise<void> {
    const { error } = await this.supabase.getClient().rpc('aplicar_movimientos_stock', {
      p_movimientos: movimientos,
      p_referencia_tipo: 'pedido',
      p_referencia_id: pedidoId,
      p_tipo: tipo,
      p_created_by: usuarioId,
    });
    if (error) throw error;

    // No bloquea la venta si falla — es una alerta, no algo que deba
    // tumbar el checkout.
    this.insumos
      .verificarYAlertarStockBajo(movimientos.map((m) => m.insumo_id))
      .catch((err) =>
        this.logger.error(`No se pudo verificar stock bajo tras ${tipo}: ${(err as Error).message}`),
      );
  }
}
