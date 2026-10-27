import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PedidosService } from '../pedidos/pedidos.service';
import {
  armarAvisoComprobante,
  esComprobanteValido,
  nombreArchivoComprobante,
} from './comprobantes';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

const SIETE_DIAS = 7 * 24 * 60 * 60;

/**
 * Foto o PDF del comprobante de transferencia que manda el cliente por
 * WhatsApp: se guarda en el bucket privado, se liga a su pedido pendiente
 * y se le avisa al equipo con un link firmado. Determinístico: el bot no
 * "lee" la imagen ni valida montos — eso lo hace una persona.
 */
@Injectable()
export class ComprobantesService {
  private readonly logger = new Logger(ComprobantesService.name);

  constructor(
    private readonly pedidos: PedidosService,
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly mail: MailService,
  ) {}

  /**
   * true si la imagen/PDF quedó como comprobante de un pedido. false si el
   * cliente no tiene un pedido esperando comprobante (quien llama responde).
   */
  async procesar(datos: {
    identificadorExterno: string;
    conversacionId: string;
    mensajeId: string;
    mediaId: string;
  }): Promise<boolean> {
    const pedido = await this.pedidos.pedidoEsperandoComprobante(
      datos.identificadorExterno,
    );
    if (!pedido) return false;

    const archivo = await this.metaGraph.descargarMedia(datos.mediaId);
    if (!esComprobanteValido(archivo.mime)) return false;
    const path = await this.pedidos.guardarComprobante(pedido.id, {
      ...archivo,
      nombre: nombreArchivoComprobante(datos.mensajeId, archivo.mime),
    });

    const respuesta = `¡Recibido el comprobante del pedido *#${pedido.id.slice(0, 8)}*! 🙌 Lo revisamos y te confirmamos por acá.`;
    await this.metaGraph.enviarMensajeSesion(
      'whatsapp',
      datos.identificadorExterno,
      respuesta,
    );
    await this.conversaciones.registrarMensaje(
      datos.conversacionId,
      'saliente_bot',
      respuesta,
    );
    this.logger.log(`Comprobante guardado para el pedido ${pedido.id}`);

    const url = await this.pedidos.urlFirmada(path, SIETE_DIAS);
    this.mail.enviarAvisoEquipo(
      armarAvisoComprobante({
        pedidoId: pedido.id,
        total: pedido.total,
        nombre: pedido.nombre,
        telefono: datos.identificadorExterno,
        url,
      }),
    );
    return true;
  }
}
