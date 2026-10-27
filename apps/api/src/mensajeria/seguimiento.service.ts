import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PedidosService } from '../pedidos/pedidos.service';
import {
  ConversacionesService,
  type ConversacionParaSeguimiento,
} from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';
import { AvisosPedidoService } from './avisos-pedido.service';

// Los plazos (recordatorio / oferta) son editables desde /admin/seguimiento
// — se leen de la tabla configuracion en cada corrida del cron, ver
// ConversacionesService.obtenerConfiguracionSeguimiento(). Quedan bajo
// responsabilidad del admin mantenerlos adentro de la ventana gratis de
// 24h de WhatsApp (mensajes de sesión) — pasado ese límite, reenganchar a
// un cliente requiere una plantilla paga aprobada por Meta, que este
// módulo no implementa a propósito (ver README).
const DESCUENTO_OFERTA_PORCENTAJE = 10; // ajustable acá, no viene de CLAUDE.md

const TEXTO_RECORDATORIO =
  '¡Hola! 🍕 Vimos que estabas armando algo con nosotros y quedó ahí colgado. ¿Seguís interesado? Escribinos y seguimos donde quedamos.';

const TEXTO_OFERTA =
  `¡Todavía estás a tiempo! Si retomás tu pedido ahora te dejamos un ${DESCUENTO_OFERTA_PORCENTAJE}% de descuento en cualquier pizza personal 🍕. Escribinos y te ayudamos a cerrarlo.`;

/**
 * Seguimiento automático de conversaciones "abandonadas" — el cliente
 * habló con el bot pero nunca llegó a derivar_a_humano (nunca confirmó
 * método de pago). No depende de Gemini: son mensajes fijos, para no
 * arriesgar que el modelo invente un descuento o un dato de negocio.
 */
@Injectable()
export class SeguimientoService {
  private readonly logger = new Logger(SeguimientoService.name);

  // Lock en memoria: alcanza porque Railway corre un solo proceso de este
  // servicio (sin escalado horizontal). Si eso cambia algún día, esto deja
  // de alcanzar y hace falta un lock real en la base (ej. advisory lock de
  // Postgres) — hasta entonces, esto evita que una corrida que tarda más
  // de 10 minutos se pise con la siguiente y mande el mismo recordatorio
  // u oferta dos veces al mismo cliente.
  private ejecutando = false;

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
    private readonly pedidos: PedidosService,
    private readonly avisosPedido: AvisosPedidoService,
  ) {}

  // Nombre explícito: identifica el job en logs y en el SchedulerRegistry
  // (sin él, @nestjs/schedule genera uno aleatorio en cada arranque).
  @Cron('*/10 * * * *', { name: 'seguimiento-conversaciones' })
  async ejecutar(): Promise<void> {
    if (this.ejecutando) {
      this.logger.warn(
        'La corrida anterior de seguimiento todavía está en curso — se salta este tick para no duplicar mensajes.',
      );
      return;
    }
    this.ejecutando = true;
    try {
      const { recordatorioMinutos, ofertaMinutos } =
        await this.conversaciones.obtenerConfiguracionSeguimiento();
      await this.enviarRecordatorios(recordatorioMinutos);
      await this.enviarOfertas(ofertaMinutos);
      // Invitación a repetir el pedido, en la última hora de la ventana de 24h.
      await this.avisosPedido.enviarRecompras();
    } finally {
      this.ejecutando = false;
    }
  }

  private async enviarRecordatorios(minutosInactividad: number): Promise<void> {
    const candidatas = await this.conversaciones.buscarInactivasSinSeguimiento(
      minutosInactividad,
    );
    for (const c of candidatas) {
      try {
        if (await this.yaCompro(c)) continue;
        await this.metaGraph.enviarMensajeSesion(c.canal, c.identificador_externo, TEXTO_RECORDATORIO);
        await this.conversaciones.registrarMensaje(c.id, 'saliente_bot', TEXTO_RECORDATORIO);
        await this.conversaciones.marcarSeguimientoEnviado(
          c.canal,
          c.identificador_externo,
          'recordatorio_enviado',
        );
        this.logger.log(`Recordatorio enviado — canal=${c.canal} id=${c.identificador_externo}`);
      } catch (err) {
        this.logger.error(
          `Error mandando recordatorio a ${c.canal}/${c.identificador_externo}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Quien hizo un pedido en las últimas 24h no abandonó nada: con el
   * checkout del bot el pedido queda registrado y la conversación sigue en
   * `bot`, así que sin este corte le llegaría "¿seguís interesado?". Se
   * cierra el seguimiento para no volver a evaluarlo en cada corrida.
   */
  private async yaCompro(c: ConversacionParaSeguimiento): Promise<boolean> {
    if (c.canal !== 'whatsapp') return false;
    const compro = await this.pedidos.tienePedidoReciente(
      c.identificador_externo,
      24,
    );
    if (!compro) return false;
    await this.conversaciones.marcarSeguimientoEnviado(
      c.canal,
      c.identificador_externo,
      'oferta_enviada',
    );
    return true;
  }

  private async enviarOfertas(minutosDesdeRecordatorio: number): Promise<void> {
    const candidatas = await this.conversaciones.buscarConRecordatorioVencido(
      minutosDesdeRecordatorio,
    );
    for (const c of candidatas) {
      try {
        if (await this.yaCompro(c)) continue;
        await this.metaGraph.enviarMensajeSesion(c.canal, c.identificador_externo, TEXTO_OFERTA);
        await this.conversaciones.registrarMensaje(c.id, 'saliente_bot', TEXTO_OFERTA);
        await this.conversaciones.marcarSeguimientoEnviado(
          c.canal,
          c.identificador_externo,
          'oferta_enviada',
        );
        this.logger.log(`Oferta enviada — canal=${c.canal} id=${c.identificador_externo}`);
      } catch (err) {
        this.logger.error(
          `Error mandando oferta a ${c.canal}/${c.identificador_externo}: ${(err as Error).message}`,
        );
      }
    }
  }
}
