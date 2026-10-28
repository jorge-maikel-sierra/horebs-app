/** Correo de aviso de domicilio: datos que recibe y HTML que arma. */

export interface NotificacionDomicilio {
  pedidoId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  direccionEntrega: string;
  items: { cantidad: number; nombre: string; precioUnitario: number }[];
  costoDomicilio: number | null;
  metodoPago: string;
  total: number;
  notas: string | null;
}

export const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo — cobrar al entregar',
  transferencia: 'Transferencia — ya pagado',
  tarjeta: 'Tarjeta — ya pagado',
};

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';
const AMARILLO = '#FFD93D';
const VERDE = '#1F9D55';

const REDES = {
  whatsapp: 'https://wa.me/573157861208',
  facebook: 'https://www.facebook.com/Pizzeriahorebs/',
  instagram: 'https://www.instagram.com/pizzeria_horebs/',
};

const ETIQUETA =
  'margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;';

/**
 * Lo que escribe el cliente (nombre, teléfono, dirección, notas) va dentro de
 * etiquetas y de atributos (`href="tel:..."`), así que también se escapa la
 * comilla doble: sin eso, un `"` rompería el atributo.
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const dinero = (valor: number): string => `$${valor.toLocaleString('es-CO')}`;

function encabezado(): string {
  return `
            <tr>
              <td style="background-color:${AZUL};padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;color:${AMARILLO};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pizzería Horebs</p>
                      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">🛵 Nuevo pedido a domicilio</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function filaTelefono(telefono: string | null): string {
  if (!telefono) return '';
  return `<tr>
                    <td style="padding:10px 0 0;">
                      <p style="${ETIQUETA}">Teléfono</p>
                      <p style="margin:2px 0 0;font-size:15px;color:${AZUL};">
                        <a href="tel:${escaparHtml(telefono)}" style="color:${AZUL};text-decoration:none;">${escaparHtml(telefono)}</a>
                      </p>
                    </td>
                  </tr>`;
}

function bloqueCliente(datos: NotificacionDomicilio): string {
  return `
            <tr>
              <td style="padding:28px 32px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:8px;padding:16px;border:1px solid #eee;">
                  <tr>
                    <td style="padding:4px 0;">
                      <p style="${ETIQUETA}">Cliente</p>
                      <p style="margin:2px 0 0;font-size:16px;font-weight:700;color:${AZUL};">${escaparHtml(datos.clienteNombre)}</p>
                    </td>
                  </tr>
                  ${filaTelefono(datos.clienteTelefono)}
                  <tr>
                    <td style="padding:10px 0 0;">
                      <p style="${ETIQUETA}">Dirección de entrega</p>
                      <p style="margin:2px 0 0;font-size:15px;color:${AZUL};">${escaparHtml(datos.direccionEntrega)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function filaItem(item: NotificacionDomicilio['items'][number]): string {
  const subtotal = item.cantidad * item.precioUnitario;
  const precioUnidad =
    item.cantidad > 1
      ? `<span style="color:#999;font-size:13px;"> (${dinero(item.precioUnitario)} c/u)</span>`
      : '';
  return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:${AZUL};font-size:15px;">
            <span style="display:inline-block;min-width:28px;font-weight:700;color:${NARANJA};">${item.cantidad}×</span>
            ${escaparHtml(item.nombre)}
            ${precioUnidad}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eee;color:${AZUL};font-size:15px;font-weight:600;white-space:nowrap;">
            ${dinero(subtotal)}
          </td>
        </tr>`;
}

function bloqueItems(items: NotificacionDomicilio['items']): string {
  return `
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Pedido</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${items.map(filaItem).join('')}
                </table>
              </td>
            </tr>`;
}

function bloqueCostoDomicilio(costo: number | null): string {
  if (!costo) return '';
  return `<tr>
              <td style="padding:8px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#888;font-size:14px;">Domicilio</td>
                    <td align="right" style="color:${AZUL};font-size:14px;font-weight:600;">${dinero(costo)}</td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function bloquePago(datos: NotificacionDomicilio): string {
  const esEfectivo = datos.metodoPago === 'efectivo';
  const metodo = METODO_PAGO_LABEL[datos.metodoPago] ?? datos.metodoPago;
  const titulo = esEfectivo
    ? '💵 COBRAR EN EFECTIVO'
    : `✅ YA PAGADO — ${metodo.split(' —')[0].toUpperCase()}`;
  return `
            <tr>
              <td style="padding:16px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${esEfectivo ? NARANJA : VERDE};border-radius:8px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td colspan="2" style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.3px;padding-bottom:6px;">
                            ${titulo}
                          </td>
                        </tr>
                        <tr>
                          <td style="color:#ffffff;font-size:15px;font-weight:600;">${esEfectivo ? 'Total a cobrar' : 'Total del pedido'}</td>
                          <td align="right" style="color:#ffffff;font-size:20px;font-weight:800;">${dinero(datos.total)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function bloqueNotas(notas: string | null): string {
  if (!notas) return '';
  return `<tr>
              <td style="padding:20px 32px 0;">
                <p style="${ETIQUETA}">Notas</p>
                <p style="margin:4px 0 0;font-size:14px;color:${AZUL};background-color:#FFF9E6;border-left:3px solid ${AMARILLO};padding:8px 12px;border-radius:4px;">${escaparHtml(notas)}</p>
              </td>
            </tr>`;
}

function enlaceRed(nombre: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin:0 10px;color:${AZUL};font-size:13px;font-weight:600;text-decoration:none;">${nombre}</a>`;
}

function bloqueRedes(): string {
  return `
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
                  <tr>
                    <td style="padding:20px 0 0;text-align:center;">
                      ${enlaceRed('WhatsApp', REDES.whatsapp)}
                      ${enlaceRed('Instagram', REDES.instagram)}
                      ${enlaceRed('Facebook', REDES.facebook)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}

function bloquePie(pedidoId: string): string {
  return `
            <tr>
              <td style="padding:16px 32px 24px;">
                <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Pedido #${pedidoId.slice(0, 8)} · Pizzería Horebs</p>
              </td>
            </tr>`;
}

export function construirHtmlDomicilio(datos: NotificacionDomicilio): string {
  return `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            ${encabezado()}
            ${bloqueCliente(datos)}
            ${bloqueItems(datos.items)}
            ${bloqueCostoDomicilio(datos.costoDomicilio)}
            ${bloquePago(datos)}
            ${bloqueNotas(datos.notas)}
            ${bloqueRedes()}
            ${bloquePie(datos.pedidoId)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
