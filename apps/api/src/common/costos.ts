// Valor confirmado en CLAUDE.md — costo de domicilio por defecto, tanto
// para el checkout web (fijo, no editable por el cliente) como para el
// POS (editable a mano por el staff, este es solo el valor sugerido).
export const COSTO_DOMICILIO_DEFAULT = 5000;

/**
 * Productos (por slug) cuyo precio ya incluye el domicilio: el Combo Personal
 * de diciembre 2026 (pizza personal + bebida + domicilio a $21.900). Si el
 * pedido trae alguno, el pedido completo va sin cargo de domicilio.
 */
export const SLUGS_DOMICILIO_INCLUIDO: ReadonlySet<string> = new Set([
  'combo-personal',
]);

export function productoIncluyeDomicilio(
  slug: string | null | undefined,
): boolean {
  return slug != null && SLUGS_DOMICILIO_INCLUIDO.has(slug);
}
