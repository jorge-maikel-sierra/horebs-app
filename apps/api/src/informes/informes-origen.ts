/**
 * De dónde llegó cada venta para el informe. La caja guarda `origen_venta`
 * desde el 17 nov 2026; las anteriores y las de otros canales se deducen del
 * canal. Una venta de caja sin origen queda aparte en vez de adivinarla.
 */
export const ORIGEN_CAJA_SIN_DATO = 'caja_sin_origen';

/**
 * En la caja, `whatsapp` es el número de WhatsApp Business del local y
 * `whatsapp_bot` el del bot; en el informe el bot se junta con los pedidos que
 * el bot registra solo (canal `whatsapp`) y WhatsApp Business queda aparte.
 */
const ORIGEN_INFORME_DE_CAJA = new Map<string, string>([
  ['whatsapp', 'whatsapp_business'],
  ['whatsapp_bot', 'whatsapp'],
]);

export function origenDePedido(
  origenVenta: string | null,
  canal: string,
): string {
  if (origenVenta)
    return ORIGEN_INFORME_DE_CAJA.get(origenVenta) ?? origenVenta;
  return canal === 'pos' ? ORIGEN_CAJA_SIN_DATO : canal;
}
