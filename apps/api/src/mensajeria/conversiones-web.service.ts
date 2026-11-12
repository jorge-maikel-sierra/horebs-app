import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorDeBase } from '../common/error-de-base';
import type { AtribucionWeb } from '../pedidos/atribucion-web';
import { SupabaseService } from '../supabase/supabase.service';
import {
  payloadPurchaseWeb,
  userDataWeb,
  type PedidoWebParaEvento,
} from './conversiones-web';
import {
  enviarEventoUnaVez,
  postearEventoMeta,
  type DestinoEventosMeta,
} from './eventos-meta';

interface FilaPedidoWeb {
  id: string;
  total: number | string;
  canal: string;
  cliente_id: string | null;
  atribucion_web: AtribucionWeb | null;
  clientes: {
    nombre: string | null;
    apellido: string | null;
    telefono: string | null;
    correo: string | null;
  } | null;
  items_pedido: { variante_id: string; cantidad: number }[] | null;
}

const COLUMNAS =
  'id, total, canal, cliente_id, atribucion_web, clientes(nombre, apellido, telefono, correo), items_pedido(variante_id, cantidad)';

/**
 * API de conversiones del sitio web: el Purchase sale desde el servidor al
 * entregar el pedido, con el mismo `event_id` que el Pixel del navegador.
 * Llega aunque el cliente tenga bloqueador de anuncios y no cuenta pedidos
 * cancelados. Mismo píxel/dataset que Messenger e Instagram.
 */
@Injectable()
export class ConversionesWebService {
  private readonly logger = new Logger(ConversionesWebService.name);
  private readonly destino: DestinoEventosMeta | null;

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
  }

  /** Fire-and-forget: nunca frena el cambio de estado en el panel. */
  avisarCompra(pedidoId: string): void {
    if (!this.destino) return;
    this.enviarCompra(pedidoId).catch((err: Error) =>
      this.logger.error(
        `No se pudo enviar el Purchase web del pedido ${pedidoId}: ${err.message}`,
      ),
    );
  }

  private async enviarCompra(pedidoId: string): Promise<void> {
    const destino = this.destino;
    if (!destino) return;
    const pedido = await this.leerPedido(pedidoId);
    if (!pedido) return;
    const userData = userDataWeb(pedido);
    if (!userData) {
      this.logger.log(
        `Pedido ${pedidoId} sin navegador registrado — no se envía Purchase web.`,
      );
      return;
    }
    const payload = payloadPurchaseWeb(pedido, userData, new Date());
    const enviado = await enviarEventoUnaVez(
      this.supabase.getClient(),
      { evento: 'Purchase', referenciaId: pedidoId },
      () => postearEventoMeta(destino, payload),
    );
    if (enviado) {
      this.logger.log(`Purchase web enviado a Meta — pedido=${pedidoId}`);
    }
  }

  private async leerPedido(
    pedidoId: string,
  ): Promise<PedidoWebParaEvento | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select(COLUMNAS)
      .eq('id', pedidoId)
      .maybeSingle<FilaPedidoWeb>();
    if (error) throw errorDeBase(error);
    if (!data || data.canal !== 'web') return null;
    return {
      id: data.id,
      total: Number(data.total),
      clienteId: data.cliente_id,
      cliente: data.clientes,
      items: (data.items_pedido ?? []).map((i) => ({
        varianteId: i.variante_id,
        cantidad: i.cantidad,
      })),
      atribucion: data.atribucion_web,
    };
  }
}
