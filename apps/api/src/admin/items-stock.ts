/**
 * Las líneas de un pedido que descuentan o devuelven stock: solo las que
 * tienen variante del catálogo (un ítem personalizado no tiene stock).
 */
export function itemsConVariante(
  items: readonly { variante_id: string | null; cantidad: number }[],
): { variante_id: string; cantidad: number }[] {
  return items
    .filter((i) => i.variante_id)
    .map((i) => ({
      variante_id: i.variante_id as string,
      cantidad: i.cantidad,
    }));
}
