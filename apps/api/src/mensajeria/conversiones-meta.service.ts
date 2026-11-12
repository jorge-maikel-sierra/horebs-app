import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { OrigenConversacionService } from './origen-conversacion.service';
import { ConversionesSocialService } from './conversiones-social.service';
import { MS_POR_SEGUNDO } from '../common/tiempo';
import { enviarEventoUnaVez, postearEventoMeta } from './eventos-meta';

const DIGITOS_TELEFONO_COLOMBIA = 10;
const MONEDA = 'COP';

type EventoMensajeria = 'LeadSubmitted' | 'Purchase';

interface EventoParaEnviar {
  evento: EventoMensajeria;
  /** Clave de idempotencia: conversación (LeadSubmitted) o pedido (Purchase). */
  referenciaId: string;
  ctwaClid: string;
  valor?: number;
}

/**
 * Conversions API for Business Messaging (Click-to-WhatsApp): le avisa a
 * Meta qué conversaciones que empezaron en un anuncio terminaron en Lead o
 * en venta, usando el `ctwa_clid` que llega en el `referral` del primer
 * mensaje. Así Meta puede optimizar la campaña hacia gente que compra y no
 * solo hacia gente que escribe.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging
 *
 * Reglas de diseño:
 * - Nunca rompe el flujo del que lo llama (bot, alta de pedido): todos los
 *   métodos públicos tragan y loguean el error.
 * - Meta NO deduplica eventos de mensajería, así que la idempotencia vive
 *   acá, en `eventos_meta_enviados` (clave primaria evento + referencia).
 * - Sin configuración completa el servicio queda apagado (no-op) en vez de
 *   fallar — se puede desplegar antes de tener el token.
 */
@Injectable()
export class ConversionesMetaService {
  private readonly logger = new Logger(ConversionesMetaService.name);
  private readonly version: string;
  private readonly token?: string;
  private readonly datasetId?: string;
  private readonly wabaId?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly origenes: OrigenConversacionService,
    private readonly social: ConversionesSocialService,
  ) {
    this.version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';
    // El token de WhatsApp puede no tener el permiso
    // `whatsapp_business_manage_events`; por eso hay uno propio, y el de
    // WhatsApp solo es respaldo.
    this.token =
      this.config.get<string>('META_CAPI_ACCESS_TOKEN') ??
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    this.datasetId = this.config.get<string>('META_DATASET_ID');
    this.wabaId = this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID');

    if (!this.token || !this.datasetId || !this.wabaId) {
      this.logger.warn(
        'META_CAPI_ACCESS_TOKEN (o WHATSAPP_ACCESS_TOKEN), META_DATASET_ID o WHATSAPP_BUSINESS_ACCOUNT_ID no configuradas — la API de conversiones de mensajería está apagada.',
      );
    }
  }

  /**
   * Cliente listo para comprar: el bot lo derivó a una persona. Messenger e
   * Instagram van por su propio servicio (otro dataset y otros ids).
   */
  async notificarLead(
    canal: string,
    identificadorExterno: string,
  ): Promise<void> {
    if (canal === 'messenger' || canal === 'instagram') {
      this.social.avisarConversacion(
        'LeadSubmitted',
        canal,
        identificadorExterno,
      );
      return;
    }
    if (canal !== 'whatsapp') return;
    await this.protegido('LeadSubmitted', async () => {
      const ctwa = await this.origenes.obtenerCtwa(
        'whatsapp',
        identificadorExterno,
      );
      if (!ctwa) return;
      await this.enviarUnaVez({
        evento: 'LeadSubmitted',
        referenciaId: ctwa.id,
        ctwaClid: ctwa.ctwaClid,
      });
    });
  }

  /**
   * Venta registrada por el equipo. Se liga a la conversación por teléfono
   * (el POS guarda 10 dígitos locales; el wa_id de WhatsApp trae el 57).
   * Si ese cliente nunca llegó por un anuncio, no hay nada que enviar.
   */
  async notificarCompra(compra: {
    telefono: string | null | undefined;
    pedidoId: string;
    total: number;
  }): Promise<void> {
    const waId = waIdColombia(compra.telefono);
    if (!waId) return;
    await this.protegido('Purchase', async () => {
      const ctwa = await this.origenes.obtenerCtwa('whatsapp', waId);
      if (!ctwa) return;
      await this.enviarUnaVez({
        evento: 'Purchase',
        referenciaId: compra.pedidoId,
        ctwaClid: ctwa.ctwaClid,
        valor: compra.total,
      });
    });
  }

  /**
   * Fire-and-forget para los flujos que no deben esperar a Meta (derivar,
   * registrar una venta): mismo patrón que MailService. Las versiones
   * async de arriba quedan para los tests y para quien sí necesite esperar.
   */
  avisarLead(canal: string, identificadorExterno: string): void {
    this.notificarLead(canal, identificadorExterno).catch((err) =>
      this.logger.error(`Lead no enviado: ${(err as Error).message}`),
    );
  }

  avisarCompra(compra: {
    telefono: string | null | undefined;
    pedidoId: string;
    total: number;
  }): void {
    this.notificarCompra(compra).catch((err) =>
      this.logger.error(
        `Purchase del pedido ${compra.pedidoId} no enviado: ${(err as Error).message}`,
      ),
    );
  }

  private async protegido(
    evento: EventoMensajeria,
    accion: () => Promise<void>,
  ): Promise<void> {
    if (!this.token || !this.datasetId || !this.wabaId) return;
    try {
      await accion();
    } catch (err) {
      this.logger.error(
        `No se pudo enviar ${evento} a la API de conversiones: ${(err as Error).message}`,
      );
    }
  }

  private async enviarUnaVez(e: EventoParaEnviar): Promise<void> {
    const enviado = await enviarEventoUnaVez(
      this.supabase.getClient(),
      { evento: e.evento, referenciaId: e.referenciaId },
      () => this.enviar(e),
    );
    if (enviado) {
      this.logger.log(
        `Evento ${e.evento} enviado a Meta — referencia=${e.referenciaId}`,
      );
    }
  }

  private async enviar(e: EventoParaEnviar): Promise<void> {
    const evento: Record<string, unknown> = {
      event_name: e.evento,
      event_time: Math.floor(Date.now() / MS_POR_SEGUNDO),
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        whatsapp_business_account_id: this.wabaId,
        ctwa_clid: e.ctwaClid,
      },
    };
    if (e.valor !== undefined) {
      evento.custom_data = { currency: MONEDA, value: e.valor };
    }

    await postearEventoMeta(
      {
        version: this.version,
        datasetId: this.datasetId ?? '',
        token: this.token ?? '',
      },
      evento,
    );
  }
}

/**
 * El POS guarda el teléfono local de 10 dígitos (3157861208); el wa_id de
 * WhatsApp es el número con indicativo de país (573157861208). Colombia
 * únicamente — es el único mercado del negocio.
 */
export function waIdColombia(
  telefono: string | null | undefined,
): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  if (digitos.length < DIGITOS_TELEFONO_COLOMBIA) return null;
  return `57${digitos.slice(-DIGITOS_TELEFONO_COLOMBIA)}`;
}
