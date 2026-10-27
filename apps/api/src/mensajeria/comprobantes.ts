const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Solo fotos y PDF cuentan como comprobante. */
export function esComprobanteValido(mime: string): boolean {
  return mime in EXTENSIONES;
}

/** wamid.HBg… → nombre de archivo estable: reenvíos de Meta lo pisan, no duplican. */
export function nombreArchivoComprobante(
  mensajeId: string,
  mime: string,
): string {
  const base =
    mensajeId.replace(/[^A-Za-z0-9_-]/g, '').slice(-40) || 'comprobante';
  // mime viene de la Graph API y solo se usa para buscar en un mapa fijo.
  // eslint-disable-next-line security/detect-object-injection
  return `${base}.${EXTENSIONES[mime] ?? 'bin'}`;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Correo al equipo: llegó el comprobante, con link firmado para verlo. */
export function armarAvisoComprobante(datos: {
  pedidoId: string;
  total: number;
  nombre: string | null;
  telefono: string;
  url: string;
}): { asunto: string; texto: string; html: string } {
  const numero = `#${datos.pedidoId.slice(0, 8)}`;
  const total = `$${datos.total.toLocaleString('es-CO')}`;
  const quien = datos.nombre ?? `+${datos.telefono}`;
  const asunto = `💸 Comprobante del pedido ${numero} — ${quien} — ${total}`;
  const texto = [
    `${quien} mandó por WhatsApp el comprobante de transferencia del pedido ${numero} (${total}).`,
    '',
    `Ver comprobante (el link vence en 7 días): ${datos.url}`,
    'Pedidos: https://pizzeriahorebs.shop/admin/pedidos',
  ].join('\n');
  const html = `<p>${escaparHtml(quien)} mandó por WhatsApp el comprobante de transferencia del pedido <b>${numero}</b> (${total}).</p>
<p><a href="${escaparHtml(datos.url)}">Ver comprobante</a> (el link vence en 7 días)</p>
<p><a href="https://pizzeriahorebs.shop/admin/pedidos">Abrir pedidos en el panel</a></p>`;
  return { asunto, texto, html };
}
