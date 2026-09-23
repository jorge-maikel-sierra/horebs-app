import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversacionesService } from './conversaciones.service';

const TIMEOUT_MS = 10_000;
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
    private readonly conversaciones: ConversacionesService,
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

  /** Cliente listo para comprar: el bot lo derivó a una persona. */
  async notificarLead(
    canal: string,
    identificadorExterno: string,
  ): Promise<void> {
    if (canal !== 'whatsapp') return;
    await this.protegido('LeadSubmitted', async () => {
      const ctwa = await this.conversaciones.obtenerCtwa(
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
      const ctwa = await this.conversaciones.obtenerCtwa('whatsapp', waId);
      if (!ctwa) return;
      await this.enviarUnaVez({
        evento: 'Purchase',
        referenciaId: compra.pedidoId,
        ctwaClid: ctwa.ctwaClid,
        valor: compra.total,
      });
    });
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

  /**
   * Reclama la clave (evento, referencia) ANTES de enviar: si otro proceso
   * ya la tomó, no se manda de nuevo. Si el envío falla se libera la clave
   * para que un próximo intento pueda reintentar.
   */
  private async enviarUnaVez(e: EventoParaEnviar): Promise<void> {
    const client = this.supabase.getClient();
    const { error: claimError } = await client
      .from('eventos_meta_enviados')
      .insert({ evento: e.evento, referencia_id: e.referenciaId });
    if (claimError) {
      if (claimError.code === '23505') return; // ya enviado
      throw claimError;
    }

    try {
      await this.enviar(e);
      this.logger.log(
        `Evento ${e.evento} enviado a Meta — referencia=${e.referenciaId}`,
      );
    } catch (err) {
      await client
        .from('eventos_meta_enviados')
        .delete()
        .eq('evento', e.evento)
        .eq('referencia_id', e.referenciaId);
      throw err;
    }
  }

  private async enviar(e: EventoParaEnviar): Promise<void> {
    const evento: Record<string, unknown> = {
      event_name: e.evento,
      event_time: Math.floor(Date.now() / 1000),
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

    // El token va en el header, no en la URL, para que no quede en logs.
    const res = await fetch(
      `https://graph.facebook.com/${this.version}/${this.datasetId}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ data: [evento] }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Graph API ${res.status}: ${cuerpo.slice(0, 300)}`,
      );
    }
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
  if (digitos.length < 10) return null;
  return `57${digitos.slice(-10)}`;
}
