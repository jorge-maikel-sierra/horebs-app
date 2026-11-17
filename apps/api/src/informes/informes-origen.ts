/**
 * De dónde llegó cada venta para el informe. La caja guarda `origen_venta`
 * desde el 17 nov 2026; las anteriores y las de otros canales se deducen del
 * canal. Una venta de caja sin origen queda aparte en vez de adivinarla.
 */
export const ORIGEN_CAJA_SIN_DATO = 'caja_sin_origen';

export function origenDePedido(
  origenVenta: string | null,
  canal: string,
): string {
  if (origenVenta) return origenVenta;
  return canal === 'pos' ? ORIGEN_CAJA_SIN_DATO : canal;
}
