/** Cómo se llama en pantalla cada origen de venta (lo que devuelve el API en `origen`). */
export const ORIGEN_LABEL: Record<string, string> = {
  mostrador: 'En el local',
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  messenger: 'Messenger',
  instagram: 'Instagram',
  web: 'Pedidos web',
  caja_sin_origen: 'Caja (sin origen)',
};

export function etiquetaOrigen(origen: string | null): string | null {
  if (!origen) return null;
  return ORIGEN_LABEL[origen] ?? origen;
}
