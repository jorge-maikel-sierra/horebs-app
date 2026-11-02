import type {
  FilaComponenteReceta,
  FilaRecetaExplosion,
  ItemVendido,
  MovimientoCalculado,
  TipoMovimientoPedido,
} from './inventario.tipos';

/**
 * Lo que un componente de receta consume para `cantidad` unidades vendidas.
 * Una subreceta se escala por `cantidad_necesaria_g / rendimiento_g` — ej. si
 * la receta pide 100g de una salsa que rinde 1140g por lote, se toma el
 * 100/1140 de cada insumo de esa salsa. Una subreceta sin rendimiento cargado
 * no se puede escalar y se omite.
 */
function consumoDeComponente(
  componente: FilaComponenteReceta,
  cantidad: number,
): MovimientoCalculado[] {
  if (componente.tipo_componente === 'insumo' && componente.insumo_id) {
    return [
      {
        insumo_id: componente.insumo_id,
        cantidad_g: componente.cantidad_necesaria_g * cantidad,
      },
    ];
  }
  const sub = componente.subrecetas;
  if (componente.tipo_componente === 'subreceta' && sub?.rendimiento_g) {
    const ratio =
      (componente.cantidad_necesaria_g / sub.rendimiento_g) * cantidad;
    return (sub.subreceta_componentes ?? []).map((c) => ({
      insumo_id: c.insumo_id,
      cantidad_g: c.cantidad_necesaria_g * ratio,
    }));
  }
  return [];
}

/**
 * Receta → subreceta → insumo (máximo 2 niveles), sumado por insumo. Las
 * variantes sin receta activa se omiten en silencio: no todos los productos
 * tienen receta cargada todavía.
 */
export function explotarRecetas(
  items: ItemVendido[],
  recetas: FilaRecetaExplosion[],
): MovimientoCalculado[] {
  const recetaPorVariante = new Map(recetas.map((r) => [r.variante_id, r]));
  const acumulado = new Map<string, number>();

  for (const item of items) {
    const componentes =
      recetaPorVariante.get(item.variante_id)?.receta_componentes ?? [];
    for (const componente of componentes) {
      for (const consumo of consumoDeComponente(componente, item.cantidad)) {
        acumulado.set(
          consumo.insumo_id,
          (acumulado.get(consumo.insumo_id) ?? 0) + consumo.cantidad_g,
        );
      }
    }
  }

  return Array.from(acumulado, ([insumo_id, cantidad_g]) => ({
    insumo_id,
    cantidad_g,
  }));
}

/** La venta resta stock: la explosión (en positivo) se aplica con signo negativo. */
export function comoSalida(
  movimientos: MovimientoCalculado[],
): MovimientoCalculado[] {
  return movimientos.map((m) => ({ ...m, cantidad_g: -m.cantidad_g }));
}

/** Argumentos de `aplicar_movimientos_stock` para un pedido. */
export function paramsMovimientosPedido(
  movimientos: MovimientoCalculado[],
  pedidoId: string,
  tipo: TipoMovimientoPedido,
  usuarioId: string | null,
): Record<string, unknown> {
  return {
    p_movimientos: movimientos,
    p_referencia_tipo: 'pedido',
    p_referencia_id: pedidoId,
    p_tipo: tipo,
    p_created_by: usuarioId,
  };
}
