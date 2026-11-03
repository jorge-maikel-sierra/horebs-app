import { Injectable, Logger } from '@nestjs/common';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { PedidoParaAvisoDto } from '../pedidos/pedidos.tipos';
import { dentroDeLaVentana, textoAvisoEstado, waId } from './avisos-pedido';
import { AvisoEquipoService } from './aviso-equipo.service';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';
import type { CanalMensajeria } from './conversaciones.tipos';

/**
 * Avisos al cliente sobre su pedido del bot: cada cambio de estado desde el panel.
 * Si el cliente no escribió en las últimas 24h, Meta los descartaría (error 100),
 * así que se verifica la ventana antes de enviar.
 */
@Injectable()
export class AvisosPedidoService {
  private readonly logger = new Logger(AvisosPedidoService.name);

  constructor(
    private readonly pedidos: PedidosConsultasService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly avisoEquipo: AvisoEquipoService,
  ) {}

  /** Fire-and-forget: un aviso que falla nunca rompe el cambio de estado. */
  notificarEstado(pedidoId: string): void {
    this.enviarAvisoEstado(pedidoId).catch((err) =>
      this.logger.error(
        `No se pudo avisar el estado del pedido ${pedidoId}: ${(err as Error).message}`,
      ),
    );
  }

  private async enviarAvisoEstado(pedidoId: string): Promise<void> {
    const pedido = await this.pedidos.datosParaAviso(pedidoId);
    if (!pedido || !pedido.telefono) return;
    const canalesValidos: string[] = ['whatsapp', 'messenger', 'instagram'];
    if (!canalesValidos.includes(pedido.canal)) return;
    const texto = textoAvisoEstado(pedido);
    if (!texto) return;

    if (pedido.canal === 'whatsapp') {
      await this.enviarAvisoWhatsapp(pedidoId, pedido, texto);
      return;
    }
    await this.enviarAvisoSocial(pedidoId, pedido, texto);
  }

  private async enviarAvisoWhatsapp(
    pedidoId: string,
    pedido: PedidoParaAvisoDto,
    texto: string,
  ): Promise<void> {
    const destino = waId(pedido.telefono ?? '');
    const ventana = await this.conversaciones.obtenerVentana(
      'whatsapp',
      destino,
    );
    if (!ventana || !dentroDeLaVentana(ventana.ultimaInteraccion, new Date())) {
      this.logger.warn(
        `Pedido ${pedidoId} → ${pedido.estado}: el cliente no escribió en 24h, WhatsApp no permite avisarle sin plantilla.`,
      );
      return;
    }
    await this.metaGraph.enviarMensajeSesion('whatsapp', destino, texto);
    await this.conversaciones.registrarMensaje(
      ventana.conversacionId,
      'saliente_bot',
      texto,
    );
    this.logger.log(`Pedido ${pedidoId} → ${pedido.estado}: aviso enviado.`);
  }

  private async enviarAvisoSocial(
    pedidoId: string,
    pedido: PedidoParaAvisoDto,
    texto: string,
  ): Promise<void> {
    const canal = pedido.canal as CanalMensajeria;
    const telefono = pedido.telefono ?? '';
    const ventana = await this.conversaciones.obtenerVentanaPorTelefono(
      canal,
      telefono,
    );
    const ahora = new Date();
    const enVentana =
      Boolean(ventana) && dentroDeLaVentana(ventana!.ultimaInteraccion, ahora);

    if (!enVentana) {
      this.avisoEquipo.notificarVentanaCerrada({
        canal,
        identificadorExterno:
          ventana?.identificadorExterno ?? pedido.telefono ?? '',
        telefono: pedido.telefono,
        conversacionId: ventana?.conversacionId,
        pedidoId,
        estadoPedido: pedido.estado,
      });
      return;
    }

    const destino = ventana?.identificadorExterno ?? telefono;
    await this.metaGraph.enviarMensajeSesion(canal, destino, texto);
    await this.conversaciones.registrarMensaje(
      ventana!.conversacionId,
      'saliente_bot',
      texto,
    );
    this.logger.log(`Pedido ${pedidoId} → ${pedido.estado}: aviso enviado.`);
  }
}
