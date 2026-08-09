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
    const itemsHtml = datos.items
      .map((i) => `<li>${i.cantidad}× ${i.nombre}</li>`)
      .join('');

    try {
      await this.transporter.sendMail({
        from: `"Pizzería Horebs" <${this.remitente}>`,
        to: destino,
        subject: `Nuevo domicilio #${datos.pedidoId.slice(0, 8)}`,
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
        html: `
          <p><strong>Cliente:</strong> ${datos.clienteNombre}</p>
          ${datos.clienteTelefono ? `<p><strong>Teléfono:</strong> ${datos.clienteTelefono}</p>` : ''}
          <p><strong>Dirección:</strong> ${datos.direccionEntrega}</p>
          <p><strong>Pedido:</strong></p>
          <ul>${itemsHtml}</ul>
          <p><strong>Total:</strong> $${datos.total.toLocaleString('es-CO')}</p>
          ${datos.notas ? `<p><strong>Notas:</strong> ${datos.notas}</p>` : ''}
        `,
      });
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el correo de domicilio para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    }
  }
}
