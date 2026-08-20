import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

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

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo — cobrar al entregar',
  transferencia: 'Transferencia — ya pagado',
  tarjeta: 'Tarjeta — ya pagado',
};

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | undefined;
  private readonly remitente: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY');
    this.remitente =
      this.config.get<string>('RESEND_FROM') ??
      'Pizzería Horebs <onboarding@resend.dev>';

    if (!this.apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — no se enviarán correos de ' +
          'notificación de domicilio.',
      );
    }
  }

  /**
   * Dispara el correo en segundo plano — nunca hay que esperar a que
   * termine antes de responderle al cliente que su pedido se creó.
   * No relanza errores: todo se atrapa y se loguea acá adentro.
   */
  enviarNotificacionDomicilio(datos: NotificacionDomicilio): void {
    this.enviar(datos).catch((err) => {
      this.logger.error(
        `No se pudo enviar el correo de domicilio para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    });
  }

  /**
   * Fire-and-forget, igual que la notificación de domicilio — un pedido
   * ya se creó, esto solo avisa que hace falta revisarlo a mano. Usa el
   * mismo correo de `correo_domiciliario` porque hoy es el único destino
   * de alertas configurado en el sistema; si se quiere un correo de
   * operaciones separado, hay que agregar esa clave a `configuracion`.
   */
  enviarAlertaStockPendiente(datos: { pedidoId: string; motivoError: string }): void {
    this.enviarAlertaStock(datos).catch((err) => {
      this.logger.error(
        `No se pudo enviar la alerta de stock pendiente para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    });
  }

  private async enviarAlertaStock(datos: { pedidoId: string; motivoError: string }) {
    if (!this.apiKey) return;

    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('valor')
      .eq('clave', 'correo_domiciliario')
      .maybeSingle();

    const destino = error ? null : data?.valor;
    if (!destino) {
      this.logger.warn(
        `No hay correo configurado para alertas — se omite el aviso de stock pendiente del pedido ${datos.pedidoId}.`,
      );
      return;
    }

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.remitente,
        to: destino,
        subject: `⚠️ Revisar stock del pedido #${datos.pedidoId.slice(0, 8)}`,
        text: [
          `El pedido ${datos.pedidoId} se registró correctamente, pero el descuento automático de stock falló.`,
          '',
          `Motivo: ${datos.motivoError}`,
          '',
          'Revisá el inventario de ese pedido a mano en el panel de admin.',
        ].join('\n'),
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Resend respondió ${res.status}: ${cuerpo}`);
    }
  }

  private async enviar(datos: NotificacionDomicilio) {
    if (!this.apiKey) return;

    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('valor')
      .eq('clave', 'correo_domiciliario')
      .maybeSingle();

    const destino = error ? null : data?.valor;
    if (!destino) {
      this.logger.warn(
        'No hay correo de domiciliario configurado — se omite el envío ' +
          `para el pedido ${datos.pedidoId}.`,
      );
      return;
    }

    const itemsTexto = datos.items
      .map(
        (i) =>
          `${i.cantidad}× ${i.nombre} — $${(i.cantidad * i.precioUnitario).toLocaleString('es-CO')}`,
      )
      .join('\n');

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.remitente,
        to: destino,
        subject: `🛵 Nuevo domicilio #${datos.pedidoId.slice(0, 8)} — ${datos.clienteNombre}`,
        text: [
          `Cliente: ${datos.clienteNombre}`,
          datos.clienteTelefono ? `Teléfono: ${datos.clienteTelefono}` : null,
          `Dirección: ${datos.direccionEntrega}`,
          '',
          'Pedido:',
          itemsTexto,
          '',
          datos.costoDomicilio
            ? `Domicilio: $${datos.costoDomicilio.toLocaleString('es-CO')}`
            : null,
          `Total: $${datos.total.toLocaleString('es-CO')}`,
          `Pago: ${METODO_PAGO_LABEL[datos.metodoPago] ?? datos.metodoPago}`,
          datos.notas ? `Notas: ${datos.notas}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        html: construirHtmlDomicilio(datos),
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Resend respondió ${res.status}: ${cuerpo}`);
    }
  }

  /**
   * A diferencia de `enviarNotificacionDomicilio` (fire-and-forget, va al
   * staff), esto lo dispara una acción del admin que espera confirmación
   * — por eso relanza el error en vez de solo loguearlo.
   */
  async enviarConAdjunto(datos: {
    destino: string;
    asunto: string;
    texto: string;
    html: string;
    adjuntoNombre: string;
    adjuntoPdf: Buffer;
  }): Promise<void> {
    if (!this.apiKey) {
      throw new Error('RESEND_API_KEY no configurada — no se puede enviar el correo.');
    }

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.remitente,
        to: datos.destino,
        subject: datos.asunto,
        text: datos.texto,
        html: datos.html,
        attachments: [
          {
            filename: datos.adjuntoNombre,
            content: datos.adjuntoPdf.toString('base64'),
          },
        ],
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Resend respondió ${res.status}: ${cuerpo}`);
    }
  }
}

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';
const AMARILLO = '#FFD93D';
const VERDE = '#1F9D55';

const REDES = {
  whatsapp: 'https://wa.me/573157861208',
  facebook: 'https://www.facebook.com/Pizzeriahorebs/',
  instagram: 'https://www.instagram.com/pizzeria_horebs/',
};

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function construirHtmlDomicilio(datos: NotificacionDomicilio): string {
  const esEfectivo = datos.metodoPago === 'efectivo';
  const filasItems = datos.items
    .map((i) => {
      const subtotal = i.cantidad * i.precioUnitario;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:${AZUL};font-size:15px;">
            <span style="display:inline-block;min-width:28px;font-weight:700;color:${NARANJA};">${i.cantidad}×</span>
            ${escaparHtml(i.nombre)}
            ${i.cantidad > 1 ? `<span style="color:#999;font-size:13px;"> ($${i.precioUnitario.toLocaleString('es-CO')} c/u)</span>` : ''}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #eee;color:${AZUL};font-size:15px;font-weight:600;white-space:nowrap;">
            $${subtotal.toLocaleString('es-CO')}
          </td>
        </tr>`;
    })
    .join('');

  return `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
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
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:8px;padding:16px;border:1px solid #eee;">
                  <tr>
                    <td style="padding:4px 0;">
                      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Cliente</p>
                      <p style="margin:2px 0 0;font-size:16px;font-weight:700;color:${AZUL};">${escaparHtml(datos.clienteNombre)}</p>
                    </td>
                  </tr>
                  ${
                    datos.clienteTelefono
                      ? `<tr>
                    <td style="padding:10px 0 0;">
                      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Teléfono</p>
                      <p style="margin:2px 0 0;font-size:15px;color:${AZUL};">
                        <a href="tel:${escaparHtml(datos.clienteTelefono)}" style="color:${AZUL};text-decoration:none;">${escaparHtml(datos.clienteTelefono)}</a>
                      </p>
                    </td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:10px 0 0;">
                      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Dirección de entrega</p>
                      <p style="margin:2px 0 0;font-size:15px;color:${AZUL};">${escaparHtml(datos.direccionEntrega)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Pedido</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${filasItems}
                </table>
              </td>
            </tr>
            ${
              datos.costoDomicilio
                ? `<tr>
              <td style="padding:8px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#888;font-size:14px;">Domicilio</td>
                    <td align="right" style="color:${AZUL};font-size:14px;font-weight:600;">$${datos.costoDomicilio.toLocaleString('es-CO')}</td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:16px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${esEfectivo ? NARANJA : VERDE};border-radius:8px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td colspan="2" style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.3px;padding-bottom:6px;">
                            ${esEfectivo ? '💵 COBRAR EN EFECTIVO' : `✅ YA PAGADO — ${(METODO_PAGO_LABEL[datos.metodoPago] ?? datos.metodoPago).split(' —')[0].toUpperCase()}`}
                          </td>
                        </tr>
                        <tr>
                          <td style="color:#ffffff;font-size:15px;font-weight:600;">${esEfectivo ? 'Total a cobrar' : 'Total del pedido'}</td>
                          <td align="right" style="color:#ffffff;font-size:20px;font-weight:800;">$${datos.total.toLocaleString('es-CO')}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${
              datos.notas
                ? `<tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Notas</p>
                <p style="margin:4px 0 0;font-size:14px;color:${AZUL};background-color:#FFF9E6;border-left:3px solid ${AMARILLO};padding:8px 12px;border-radius:4px;">${escaparHtml(datos.notas)}</p>
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
                  <tr>
                    <td style="padding:20px 0 0;text-align:center;">
                      <a href="${REDES.whatsapp}" style="display:inline-block;margin:0 10px;color:${AZUL};font-size:13px;font-weight:600;text-decoration:none;">WhatsApp</a>
                      <a href="${REDES.instagram}" style="display:inline-block;margin:0 10px;color:${AZUL};font-size:13px;font-weight:600;text-decoration:none;">Instagram</a>
                      <a href="${REDES.facebook}" style="display:inline-block;margin:0 10px;color:${AZUL};font-size:13px;font-weight:600;text-decoration:none;">Facebook</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;">
                <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Pedido #${datos.pedidoId.slice(0, 8)} · Pizzería Horebs</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
