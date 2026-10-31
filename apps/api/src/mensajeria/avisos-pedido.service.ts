import { Injectable, Logger } from '@nestjs/common';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import type { PedidoParaAvisoDto } from '../pedidos/pedidos.tipos';
import { PuntosService } from '../clientes/puntos.service';
import {
  dentroDeLaVentana,
  enVentanaDeRecompra,
  textoAvisoEstado,
  textoRecompra,
} from './avisos-pedido';
import { BOTON } from './checkout-whatsapp';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

/** clientes.telefono se guarda local (3187592616); WhatsApp usa 573187592616. */
function waId(telefonoLocal: string): string {
  const digitos = telefonoLocal.replace(/\D/g, '');
  return digitos.startsWith('57') && digitos.length === 12
    ? digitos
    : `57${digitos}`;
}

/**
 * Avisos al cliente por WhatsApp sobre su pedido del bot: cada cambio de
 * estado desde el panel y la invitación a repetir antes de que se cierre la
 * ventana de 24h. Textos fijos (avisos-pedido.ts), sin modelo. Solo
 * mensajes de sesión: si el cliente no escribió en las últimas 24h, Meta
 * los descartaría, así que ni se intenta.
 */
@Injectable()
export class AvisosPedidoService {
  private readonly logger = new Logger(AvisosPedidoService.name);

  constructor(
    private readonly pedidos: PedidosConsultasService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly puntos: PuntosService,
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
    if (!pedido || pedido.canal !== 'whatsapp' || !pedido.telefono) return;
    const texto = textoAvisoEstado(pedido);
    if (!texto) return;
    const destino = waId(pedido.telefono);
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

  /** La corre el cron de seguimiento cada 10 minutos. */
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
    // Se marca antes de enviar: si el envío falla no se reintenta, pero
    // tampoco puede llegar dos veces.
    if (!(await this.pedidos.reclamarRecompra(pedido.id))) return;
    const config = await this.puntos.obtenerConfiguracion();
    const texto = textoRecompra({
      ganados: pedido.puntosGanados ?? 0,
      saldo: pedido.puntosActuales ?? 0,
      valorPuntoPesos: config.valorPuntoPesos,
      minimoCanje: config.puntosMinimoCanje,
    });
    await this.metaGraph.enviarBotones(destino, texto, [
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
