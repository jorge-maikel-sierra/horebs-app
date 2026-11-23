/**
 * Escapa texto que viene de afuera (clientes, reseñas, búsquedas de Google)
 * antes de meterlo en un correo HTML. También la comilla doble: el texto
 * puede terminar dentro de un atributo (`href="..."`).
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
