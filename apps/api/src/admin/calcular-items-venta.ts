import { BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerVariantesActivas } from '../pedidos/calcular-items';
import type { ItemVentaCalculado, ItemVentaInput } from './pedidos-admin.tipos';

/**
 * Calcula los items de una venta de mostrador. A diferencia de
 * calcularItems (carrito público), acá se admite: (a) un precio
 * manual por item — para bordes, adicionales o ajustes puntuales —
 * y (b) items sin variante_id, con nombre_personalizado libre,
 * para productos que no están en el catálogo.
 */
export async function calcularItemsVenta(
  client: SupabaseClient,
  items: ItemVentaInput[],
): Promise<{ itemsCalculados: ItemVentaCalculado[]; total: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('El carrito está vacío.');
  }

  const varianteIds = items
    .filter((i) => i.variante_id)
    .map((i) => i.variante_id as string);

  const variantePorId = await obtenerVariantesActivas(client, varianteIds);

  const itemsCalculados: ItemVentaCalculado[] = items.map((item) => {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new BadRequestException('Cantidad inválida.');
    }
    if (
      item.precio_unitario !== undefined &&
      (typeof item.precio_unitario !== 'number' || item.precio_unitario < 0)
    ) {
      throw new BadRequestException('El precio no puede ser negativo.');
    }

    if (item.variante_id) {
      const variante = variantePorId.get(item.variante_id);
      if (!variante) {
        throw new BadRequestException('Uno de los productos no existe.');
      }
      const precioCatalogo = variante.precio_oferta ?? variante.precio;
      const precioUnitario = item.precio_unitario ?? precioCatalogo;
      return {
        variante_id: item.variante_id,
        nombre_personalizado: null,
        producto_nombre: variante.productos?.nombre ?? '',
        variante_nombre: variante.nombre,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        subtotal: precioUnitario * item.cantidad,
      };
    }

    if (!item.nombre_personalizado?.trim()) {
      throw new BadRequestException(
        'Falta el nombre del producto personalizado.',
      );
    }
    if (item.precio_unitario === undefined) {
      throw new BadRequestException(
        'Falta el precio del producto personalizado.',
      );
    }
    const nombre = item.nombre_personalizado.trim();
    return {
      variante_id: null,
      nombre_personalizado: nombre,
      producto_nombre: nombre,
      variante_nombre: '',
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.precio_unitario * item.cantidad,
    };
  });

  const total = itemsCalculados.reduce((acc, i) => acc + i.subtotal, 0);
  return { itemsCalculados, total };
}
