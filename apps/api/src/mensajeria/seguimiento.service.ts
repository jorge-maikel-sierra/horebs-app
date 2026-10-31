import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { estadoAtencion } from '../common/horario';
import { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import {
  ConversacionesService,
  type ConversacionParaSeguimiento,
  type EtapaSeguimiento,
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
// Descuento confirmado por el dueño (CLAUDE.md, sección 2): no se cambia sin su decisión.
const DESCUENTO_OFERTA_PORCENTAJE = 10;

/** Quien compró en este plazo no abandonó nada. */
const HORAS_YA_COMPRO = 24;

const TEXTO_RECORDATORIO =
  '¡Hola! 🍕 Vimos que estabas armando algo con nosotros y quedó ahí colgado. ¿Seguís interesado? Escribinos y seguimos donde quedamos.';

const TEXTO_OFERTA = `¡Todavía estás a tiempo! Si retomás tu pedido ahora te dejamos un ${DESCUENTO_OFERTA_PORCENTAJE}% de descuento en cualquier pizza personal 🍕. Escribinos y te ayudamos a cerrarlo.`;

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
    private readonly pedidos: PedidosConsultasService,
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
    // Nada de mensajes automáticos fuera del horario del bot (11:00 a.m. a
    // 11:00 p.m.): un recordatorio a las 2 a.m. no vende, molesta.
    if (estadoAtencion(new Date()) === 'cerrado') return;
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
    const candidatas =
      await this.conversaciones.buscarInactivasSinSeguimiento(
        minutosInactividad,
      );
    await this.enviarSeguimiento(candidatas, {
      nombre: 'Recordatorio',
      texto: TEXTO_RECORDATORIO,
      marca: 'recordatorio_enviado',
    });
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
      HORAS_YA_COMPRO,
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
    await this.enviarSeguimiento(candidatas, {
      nombre: 'Oferta',
      texto: TEXTO_OFERTA,
      marca: 'oferta_enviada',
    });
  }

  /** Manda el mismo mensaje fijo a cada candidata, registra y marca el envío. */
  private async enviarSeguimiento(
    candidatas: ConversacionParaSeguimiento[],
    envio: { nombre: string; texto: string; marca: EtapaSeguimiento },
  ): Promise<void> {
    for (const c of candidatas) {
      try {
        if (await this.yaCompro(c)) continue;
        await this.metaGraph.enviarMensajeSesion(
          c.canal,
          c.identificador_externo,
          envio.texto,
        );
        await this.conversaciones.registrarMensaje(
          c.id,
          'saliente_bot',
          envio.texto,
        );
        await this.conversaciones.marcarSeguimientoEnviado(
          c.canal,
          c.identificador_externo,
          envio.marca,
        );
        this.logger.log(
          `${envio.nombre} enviado — canal=${c.canal} id=${c.identificador_externo}`,
        );
      } catch (err) {
        this.logger.error(
          `Error mandando ${envio.nombre.toLowerCase()} a ${c.canal}/${c.identificador_externo}: ${(err as Error).message}`,
        );
      }
    }
  }
}
