import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import {
  actionSourceDeVenta,
  eventoVigente,
  payloadPurchaseCaja,
  userDataCaja,
  type VentaCajaParaEvento,
} from './conversiones-caja';
import { ConversionesMetaService } from './conversiones-meta.service';
import {
  enviarEventoUnaVez,
  postearEventoMeta,
  type DestinoEventosMeta,
} from './eventos-meta';

export type ResultadoCompraCaja =
  'enviada' | 'repetida' | 'por_anuncio' | 'sin_datos' | 'vencida' | 'apagado';

/**
 * Purchase de las ventas de caja (el 97% de las ventas): el cliente se
 * identifica con su teléfono y nombre cifrados y Meta lo empareja con quien
 * vio o tocó un anuncio. Si el cliente llegó por un anuncio de WhatsApp que
 * atiende el bot, sale el evento con `ctwa_clid` (más preciso) y este no.
 * Mismo dataset que el píxel, la web, Messenger e Instagram.
 */
@Injectable()
export class ConversionesCajaService {
  private readonly logger = new Logger(ConversionesCajaService.name);
  private readonly destino: DestinoEventosMeta | null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly whatsapp: ConversionesMetaService,
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
  }

  /** Fire-and-forget: la venta nunca espera a Meta ni se cae por él. */
  avisarVenta(venta: VentaCajaParaEvento): void {
    this.enviarVenta(venta).catch((err: Error) =>
      this.logger.error(
        `No se pudo enviar el Purchase de caja del pedido ${venta.pedidoId}: ${err.message}`,
      ),
    );
  }

  async enviarVenta(
    venta: VentaCajaParaEvento,
    ahora: Date = new Date(),
  ): Promise<ResultadoCompraCaja> {
    const destino = this.destino;
    if (!destino) return 'apagado';
    if (await this.llegoPorAnuncio(venta)) return 'por_anuncio';
    const userData = userDataCaja(venta.cliente);
    if (!userData) return 'sin_datos';
    const fuente = actionSourceDeVenta(venta.origen, venta.modalidad);
    if (!eventoVigente(fuente, venta.creadoEn, ahora)) return 'vencida';
    const payload = payloadPurchaseCaja(venta, userData);
    const enviado = await enviarEventoUnaVez(
      this.supabase.getClient(),
      { evento: 'Purchase', referenciaId: venta.pedidoId },
      () => postearEventoMeta(destino, payload),
    );
    if (enviado) {
      this.logger.log(
        `Purchase de caja enviado a Meta — pedido=${venta.pedidoId} fuente=${fuente}`,
      );
    }
    return enviado ? 'enviada' : 'repetida';
  }

  private llegoPorAnuncio(venta: VentaCajaParaEvento): Promise<boolean> {
    return this.whatsapp.notificarCompra({
      telefono: venta.cliente.telefono,
      pedidoId: venta.pedidoId,
      total: venta.total,
    });
  }
}
