import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import {
  claveDiaria,
  esCanalSocial,
  payloadEventoSocial,
  userDataSocial,
  type CanalSocial,
  type CuentasSocial,
  type EventoConversacion,
  type EventoPedido,
  type EventoSocial,
} from './conversiones-social';
import {
  enviarEventoUnaVez,
  postearEventoMeta,
  type DestinoEventosMeta,
} from './eventos-meta';

interface PedidoParaEvento {
  canal: string;
  identificadorExterno: string;
  pedidoId: string;
  total: number;
}

interface EnvioSocial {
  evento: EventoSocial;
  canal: CanalSocial;
  identificadorExterno: string;
  referenciaId: string;
  valor?: number;
}

/**
 * Conversions API for Business Messaging para Messenger e Instagram: le
 * cuenta a Meta qué pasó dentro del chat (vio el menú, armó carrito, empezó
 * el pedido, compró) para que los anuncios optimicen hacia gente que compra.
 * https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging
 *
 * Mismas reglas que el servicio de WhatsApp: nunca rompe el flujo de quien
 * llama (todo es fire-and-forget y traga el error), la idempotencia vive en
 * `eventos_meta_enviados` y sin configuración queda apagado.
 */
@Injectable()
export class ConversionesSocialService {
  private readonly logger = new Logger(ConversionesSocialService.name);
  private readonly destino: DestinoEventosMeta | null;
  private readonly cuentas: CuentasSocial;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    const token =
      this.config.get<string>('META_EVENTS_ACCESS_TOKEN') ??
      this.config.get<string>('META_CAPI_ACCESS_TOKEN');
    const datasetId = this.config.get<string>('META_DATASET_ID_SOCIAL');
    this.destino =
      token && datasetId
        ? {
            token,
            datasetId,
            version:
              this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0',
          }
        : null;
    this.cuentas = {
      pageId: this.config.get<string>('MESSENGER_PAGE_ID'),
      instagramId: this.config.get<string>('INSTAGRAM_ACCOUNT_ID'),
    };
    if (!this.destino) {
      this.logger.warn(
        'META_EVENTS_ACCESS_TOKEN o META_DATASET_ID_SOCIAL no configuradas — la API de conversiones de Messenger e Instagram está apagada.',
      );
    }
  }

  /** Paso del embudo dentro del chat: cuenta una vez por cliente y día. */
  avisarConversacion(
    evento: EventoConversacion,
    canal: string,
    identificadorExterno: string,
  ): void {
    if (!esCanalSocial(canal)) return;
    this.enviarProtegido({
      evento,
      canal,
      identificadorExterno,
      referenciaId: claveDiaria(canal, identificadorExterno, new Date()),
    });
  }

  /** Pedido recién creado por el bot: se conoce el cliente sin ir a la base. */
  avisarPedido(evento: EventoPedido, pedido: PedidoParaEvento): void {
    if (!esCanalSocial(pedido.canal)) return;
    this.enviarProtegido({
      evento,
      canal: pedido.canal,
      identificadorExterno: pedido.identificadorExterno,
      referenciaId: pedido.pedidoId,
      valor: pedido.total,
    });
  }

  /**
   * Cambio de estado hecho desde el panel (entregado, cancelado): el cliente
   * se busca por la conversación ligada al pedido.
   */
  avisarPedidoPorId(evento: EventoPedido, pedidoId: string): void {
    if (!this.destino) return;
    this.buscarPedido(pedidoId)
      .then((pedido) => {
        if (pedido) this.avisarPedido(evento, pedido);
      })
      .catch((err: Error) =>
        this.logger.error(
          `No se pudo leer el pedido ${pedidoId} para ${evento}: ${err.message}`,
        ),
      );
  }

  private async buscarPedido(
    pedidoId: string,
  ): Promise<PedidoParaEvento | null> {
    const client = this.supabase.getClient();
    const { data: pedido, error } = await client
      .from('pedidos')
      .select('total, conversacion_id')
      .eq('id', pedidoId)
      .maybeSingle<{ total: number; conversacion_id: string | null }>();
    if (error) throw errorDeBase(error);
    if (!pedido?.conversacion_id) return null;

    const { data: conversacion, error: errorConv } = await client
      .from('conversaciones_bot')
      .select('canal, identificador_externo')
      .eq('id', pedido.conversacion_id)
      .maybeSingle<{ canal: string; identificador_externo: string }>();
    if (errorConv) throw errorDeBase(errorConv);
    if (!conversacion) return null;
    return {
      canal: conversacion.canal,
      identificadorExterno: conversacion.identificador_externo,
      pedidoId,
      total: Number(pedido.total),
    };
  }

  private enviarProtegido(envio: EnvioSocial): void {
    this.enviar(envio).catch((err: Error) =>
      this.logger.error(
        `No se pudo enviar ${envio.evento} de ${envio.canal} a la API de conversiones: ${err.message}`,
      ),
    );
  }

  private async enviar(envio: EnvioSocial): Promise<void> {
    const destino = this.destino;
    if (!destino) return;
    const userData = userDataSocial(
      envio.canal,
      envio.identificadorExterno,
      this.cuentas,
    );
    if (!userData) return;
    const payload = payloadEventoSocial({
      evento: envio.evento,
      canal: envio.canal,
      userData,
      ahora: new Date(),
      valor: envio.valor,
    });
    const enviado = await enviarEventoUnaVez(
      this.supabase.getClient(),
      { evento: envio.evento, referenciaId: envio.referenciaId },
      () => postearEventoMeta(destino, payload),
    );
    if (enviado) {
      this.logger.log(
        `Evento ${envio.evento} de ${envio.canal} enviado a Meta — referencia=${envio.referenciaId}`,
      );
    }
  }
}
