import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SupabaseService } from '../supabase/supabase.service';

export interface NotificacionDomicilio {
  pedidoId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  direccionEntrega: string;
  items: { cantidad: number; nombre: string }[];
  total: number;
  notas: string | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly remitente: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');

    if (!user || !pass) {
      this.logger.warn(
        'GMAIL_USER o GMAIL_APP_PASSWORD no configuradas — no se enviarán ' +
          'correos de notificación de domicilio.',
      );
      this.transporter = null;
      this.remitente = undefined;
      return;
    }

    this.remitente = user;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      // Gmail SMTP puede tardar o directamente colgarse en algunos hosts;
      // estos límites evitan que un pedido se quede esperando el correo.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
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

  private async enviar(datos: NotificacionDomicilio) {
    if (!this.transporter) return;

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
      .map((i) => `${i.cantidad}× ${i.nombre}`)
      .join('\n');

    try {
      await this.transporter.sendMail({
        from: `"Pizzería Horebs" <${this.remitente}>`,
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
          `Total: $${datos.total.toLocaleString('es-CO')}`,
          datos.notas ? `Notas: ${datos.notas}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        html: construirHtmlDomicilio(datos),
      });
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el correo de domicilio para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    }
  }
}

const NARANJA = '#FF6B35';
const AZUL = '#1A3A52';
const AMARILLO = '#FFD93D';

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function construirHtmlDomicilio(datos: NotificacionDomicilio): string {
  const filasItems = datos.items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:${AZUL};font-size:15px;">
            <span style="display:inline-block;min-width:28px;font-weight:700;color:${NARANJA};">${i.cantidad}×</span>
            ${escaparHtml(i.nombre)}
          </td>
        </tr>`,
    )
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
            <tr>
              <td style="padding:16px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${NARANJA};border-radius:8px;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#ffffff;font-size:15px;font-weight:600;">Total a cobrar</td>
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
              <td style="padding:28px 32px 24px;">
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
