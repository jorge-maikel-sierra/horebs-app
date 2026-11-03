import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { PedidoParaAvisoDto } from '../pedidos/pedidos.tipos';
import { PuntosService } from '../clientes/puntos.service';
import { enVentanaDeRecompra, textoRecompra, waId } from './avisos-pedido';
import { BOTON } from './checkout-whatsapp';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

/**
 * Invitación a repetir el pedido por WhatsApp en la última hora de la ventana de 24h.
 */
@Injectable()
export class RecomprasService {
  private readonly logger = new Logger(RecomprasService.name);

  constructor(
    private readonly pedidos: PedidosConsultasService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly puntos: PuntosService,
  ) {}

  /** Corre cada 10 minutos para invitar a repetir pedidos en la última hora de la ventana. */
  @Cron('*/10 * * * *', { name: 'recompras-pedidos' })
  async enviarRecompras(): Promise<void> {
    const pedidos = await this.pedidos.pedidosParaRecompra();
    const ahora = new Date();
    for (const pedido of pedidos) {
      try {
        await this.enviarRecompra(pedido, ahora);
      } catch (err) {
        this.logger.error(
          `Error mandando la invitación a repetir del pedido ${pedido.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async enviarRecompra(
    pedido: PedidoParaAvisoDto,
    ahora: Date,
  ): Promise<void> {
    if (!pedido.telefono) return;
    const destino = waId(pedido.telefono);
    const ventana = await this.conversaciones.obtenerVentana(
      'whatsapp',
      destino,
    );
    if (
      !ventana ||
      ventana.estado === 'derivado' ||
      !enVentanaDeRecompra(ventana.ultimaInteraccion, ahora)
    ) {
      return;
    }
    if (!(await this.pedidos.reclamarRecompra(pedido.id))) return;
    const config = await this.puntos.obtenerConfiguracion();
    const texto = textoRecompra({
      ganados: pedido.puntosGanados ?? 0,
      saldo: pedido.puntosActuales ?? 0,
      valorPuntoPesos: config.valorPuntoPesos,
      minimoCanje: config.puntosMinimoCanje,
    });
    await this.metaGraph.enviarBotones('whatsapp', destino, texto, [
      { id: BOTON.loMismo, titulo: '🍕 Pedir lo mismo' },
    ]);
    await this.conversaciones.registrarMensaje(
      ventana.conversacionId,
      'saliente_bot',
      `${texto}\n[🍕 Pedir lo mismo]`,
    );
    this.logger.log(`Invitación a repetir enviada — pedido ${pedido.id}`);
  }
}
