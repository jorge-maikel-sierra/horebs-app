import { BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ItemInput {
  variante_id: string;
  cantidad: number;
}

export interface ItemCalculado {
  variante_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto_nombre: string;
  variante_nombre: string;
}

/**
 * Recalcula precios desde la base (nunca confía en precios enviados por
 * el cliente). Compartido entre pedidos web y ventas de POS.
 */
export async function calcularItems(
  client: SupabaseClient,
  items: ItemInput[],
): Promise<{ itemsCalculados: ItemCalculado[]; total: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('El carrito está vacío.');
  }
  for (const item of items) {
    if (!item.variante_id || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new BadRequestException('Item de pedido inválido.');
    }
  }

  const varianteIds = items.map((i) => i.variante_id);
  const { data: variantes, error } = await client
    .from('variantes_producto')
    .select('id, nombre, precio, precio_oferta, productos(nombre)')
    .in('id', varianteIds)
    .eq('activo', true);

  if (error) throw error;
  if (!variantes || variantes.length !== new Set(varianteIds).size) {
    throw new BadRequestException(
      'Uno o más productos ya no están disponibles.',
    );
  }

  const varianteById = new Map(variantes.map((v) => [v.id, v]));

  const itemsCalculados: ItemCalculado[] = items.map((item) => {
    const variante = varianteById.get(item.variante_id);
    if (!variante) {
      throw new BadRequestException('Uno de los productos no existe.');
    }
    const precioUnitario = variante.precio_oferta ?? variante.precio;
    return {
      variante_id: item.variante_id,
      cantidad: item.cantidad,
      precio_unitario: precioUnitario,
      subtotal: precioUnitario * item.cantidad,
      producto_nombre: (variante as any).productos?.nombre ?? '',
      variante_nombre: variante.nombre,
    };
  });

  const total = itemsCalculados.reduce((acc, i) => acc + i.subtotal, 0);
  return { itemsCalculados, total };
}
