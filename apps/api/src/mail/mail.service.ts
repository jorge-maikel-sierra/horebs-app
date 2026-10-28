import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  construirHtmlDomicilio,
  METODO_PAGO_LABEL,
  type NotificacionDomicilio,
} from './plantilla-domicilio';

const RESEND_API_URL = 'https://api.resend.com/emails';
/** Clave de `configuracion` con el correo que recibe los avisos del bot. */
export const CLAVE_CORREO_AVISOS_BOT = 'correo_avisos_bot';

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
  enviarAlertaStockPendiente(datos: {
    pedidoId: string;
    motivoError: string;
  }): void {
    this.enviarAlertaStock(datos).catch((err) => {
      this.logger.error(
        `No se pudo enviar la alerta de stock pendiente para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    });
  }

  /**
   * Mismo patrón que enviarAlertaStockPendiente — el canje de puntos falló
   * después de crear el pedido, hay que revisarlo a mano.
   */
  enviarAlertaPuntosPendientes(datos: {
    pedidoId: string;
    motivoError: string;
  }): void {
    this.enviarAlertaPuntos(datos).catch((err) => {
      this.logger.error(
        `No se pudo enviar la alerta de puntos pendientes para el pedido ${datos.pedidoId}: ${(err as Error).message}`,
      );
    });
  }

  /**
   * Fire-and-forget — se dispara apenas un insumo cruza su stock mínimo
   * (ventas, ajustes o merma), con cooldown de 24h manejado por quien
   * llama (InsumosService) para no mandar un correo por cada venta.
   */
  enviarAlertaStockBajo(
    insumos: {
      nombre: string;
      unidad: string;
      stockActual: number;
      stockMinimo: number;
    }[],
  ): void {
    this.enviarAlertaStockBajoInterno(insumos).catch((err) => {
      this.logger.error(
        `No se pudo enviar la alerta de stock bajo: ${(err as Error).message}`,
      );
    });
  }

  /**
   * Fire-and-forget, mismo patrón que las alertas de stock — el bot ya
   * derivó la conversación; esto solo avisa al equipo por correo, que no
   * tiene la ventana de 24h de WhatsApp. Va SOLO a `correo_avisos_bot`
   * (editable en /admin/configuracion): sin esa clave no se manda, nunca
   * cae al correo del domiciliario.
   */
  enviarAvisoEquipo(aviso: {
    asunto: string;
    texto: string;
    html: string;
  }): void {
    this.enviarAvisoEquipoInterno(aviso).catch((err) => {
      this.logger.error(
        `No se pudo enviar el aviso al equipo "${aviso.asunto}": ${(err as Error).message}`,
      );
    });
  }

  private async enviarAvisoEquipoInterno(aviso: {
    asunto: string;
    texto: string;
    html: string;
  }) {
    if (!this.apiKey) return;

    const destino = await this.obtenerCorreo(CLAVE_CORREO_AVISOS_BOT);
    if (!destino) {
      this.logger.warn(
        `No hay ${CLAVE_CORREO_AVISOS_BOT} configurado — se omite el aviso "${aviso.asunto}".`,
      );
      return;
    }

    await this.enviarPorResend({
      to: destino,
      subject: aviso.asunto,
      text: aviso.texto,
      html: aviso.html,
    });
  }

  private async obtenerCorreoAlertas(): Promise<string | null> {
    return this.obtenerCorreo('correo_domiciliario');
  }

  private async obtenerCorreo(clave: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('valor')
      .eq('clave', clave)
      .maybeSingle<{ valor: string | null }>();
    return error ? null : data?.valor || null;
  }

  /**
   * Correo que recibe las alertas, o null si no hay clave de Resend o no hay
   * correo configurado (en ese caso deja `omitido` en el log).
   */
  private async destinoDeAlertas(omitido: string): Promise<string | null> {
    if (!this.apiKey) return null;
    const destino = await this.obtenerCorreoAlertas();
    if (!destino) this.logger.warn(omitido);
    return destino;
  }

  /** Un solo envío a Resend; lanza ServiceUnavailable si responde con error. */
  private async enviarPorResend(correo: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.remitente, ...correo }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Resend respondió ${res.status}: ${cuerpo}`,
      );
    }
  }

  private async enviarAlertaStockBajoInterno(
    insumos: {
      nombre: string;
      unidad: string;
      stockActual: number;
      stockMinimo: number;
    }[],
  ) {
    if (insumos.length === 0) return;

    const destino = await this.destinoDeAlertas(
      'No hay correo configurado para alertas — se omite el aviso de stock bajo.',
    );
    if (!destino) return;

    const lineas = insumos.map(
      (i) =>
        `• ${i.nombre}: ${i.stockActual}${i.unidad} (mínimo: ${i.stockMinimo}${i.unidad})`,
    );

    await this.enviarPorResend({
      to: destino,
      subject:
        insumos.length === 1
          ? `⚠️ Stock bajo — ${insumos[0].nombre}`
          : `⚠️ Stock bajo en ${insumos.length} insumos`,
      text: [
        'Estos insumos están en su stock mínimo o por debajo:',
        '',
        ...lineas,
        '',
        'Revisá si hace falta hacer una compra o corregir el stock desde el panel de admin.',
      ].join('\n'),
    });
  }

  private async enviarAlertaStock(datos: {
    pedidoId: string;
    motivoError: string;
  }) {
    const destino = await this.destinoDeAlertas(
      `No hay correo configurado para alertas — se omite el aviso de stock pendiente del pedido ${datos.pedidoId}.`,
    );
    if (!destino) return;

    await this.enviarPorResend({
      to: destino,
      subject: `⚠️ Revisar stock del pedido #${datos.pedidoId.slice(0, 8)}`,
      text: [
        `El pedido ${datos.pedidoId} se registró correctamente, pero el descuento automático de stock falló.`,
        '',
        `Motivo: ${datos.motivoError}`,
        '',
        'Revisá el inventario de ese pedido a mano en el panel de admin.',
      ].join('\n'),
    });
  }

  private async enviarAlertaPuntos(datos: {
    pedidoId: string;
    motivoError: string;
  }) {
    const destino = await this.destinoDeAlertas(
      `No hay correo configurado para alertas — se omite el aviso de puntos pendientes del pedido ${datos.pedidoId}.`,
    );
    if (!destino) return;

    await this.enviarPorResend({
      to: destino,
      subject: `⚠️ Revisar puntos del pedido #${datos.pedidoId.slice(0, 8)}`,
      text: [
        `El pedido ${datos.pedidoId} se registró correctamente, pero el canje de puntos de fidelidad falló.`,
        '',
        `Motivo: ${datos.motivoError}`,
        '',
        'Revisá el saldo de puntos del cliente a mano en el panel de admin.',
      ].join('\n'),
    });
  }

  private async enviar(datos: NotificacionDomicilio) {
    const destino = await this.destinoDeAlertas(
      'No hay correo de domiciliario configurado — se omite el envío ' +
        `para el pedido ${datos.pedidoId}.`,
    );
    if (!destino) return;

    const itemsTexto = datos.items
      .map(
        (i) =>
          `${i.cantidad}× ${i.nombre} — $${(i.cantidad * i.precioUnitario).toLocaleString('es-CO')}`,
      )
      .join('\n');

    await this.enviarPorResend({
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
    });
  }
}
