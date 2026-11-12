import { OFERTA_SEGUIMIENTO_PORCENTAJE } from '../common/promocion';
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
import { AvisoEquipoService } from './aviso-equipo.service';
import { dentroDeLaVentana } from './avisos-pedido';

// Los plazos (recordatorio / oferta) son editables desde /admin/seguimiento
// — se leen de la tabla configuracion en cada corrida del cron, ver
// ConversacionesService.obtenerConfiguracionSeguimiento(). Quedan bajo
// responsabilidad del admin mantenerlos adentro de la ventana gratis de
// 24h de WhatsApp (mensajes de sesión) — pasado ese límite, reenganchar a
// un cliente requiere una plantilla paga aprobada por Meta, que este
// módulo no implementa a propósito (ver README).

/** Quien compró en este plazo no abandonó nada. */
const HORAS_YA_COMPRO = 24;

const TEXTO_RECORDATORIO =
  '¡Hola! 🍕 Vimos que estabas armando algo con nosotros y quedó ahí colgado. ¿Sigues interesado? Escríbenos y seguimos donde quedamos.';

const TEXTO_OFERTA = `¡Todavía estás a tiempo! Si retomas tu pedido ahora te dejamos un ${OFERTA_SEGUIMIENTO_PORCENTAJE}% de descuento en cualquier pizza personal 🍕. Escríbenos y te ayudamos a cerrarlo.`;

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
    private readonly avisoEquipo: AvisoEquipoService,
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
   * `bot`, así que sin este corte le llegaría "¿sigues interesado?". Se
   * cierra el seguimiento para no volver a evaluarlo en cada corrida.
   * En Messenger e Instagram busca por el teléfono capturado en la conversación.
   */
  private async yaCompro(c: ConversacionParaSeguimiento): Promise<boolean> {
    const telefono =
      c.canal === 'whatsapp' ? c.identificador_externo : c.telefono;
    if (!telefono) return false;
    const compro = await this.pedidos.tienePedidoReciente(
      telefono,
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
        await this.procesarSeguimiento(c, envio);
      } catch (err) {
        this.logger.error(
          `Error mandando ${envio.nombre.toLowerCase()} a ${c.canal}/${c.identificador_externo}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async procesarSeguimiento(
    c: ConversacionParaSeguimiento,
    envio: { nombre: string; texto: string; marca: EtapaSeguimiento },
  ): Promise<void> {
    if (await this.yaCompro(c)) return;

    if (c.canal !== 'whatsapp' && !this.enVentanaSeguimiento(c)) {
      this.avisoEquipo.notificarVentanaCerrada({
        canal: c.canal,
        identificadorExterno: c.identificador_externo,
        telefono: c.telefono ?? null,
        conversacionId: c.id,
      });
      await this.conversaciones.marcarSeguimientoEnviado(
        c.canal,
        c.identificador_externo,
        'oferta_enviada',
      );
      return;
    }

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
      envio.marca === 'oferta_enviada',
    );
    this.logger.log(
      `${envio.nombre} enviado — canal=${c.canal} id=${c.identificador_externo}`,
    );
  }

  private enVentanaSeguimiento(c: ConversacionParaSeguimiento): boolean {
    if (!c.ultima_interaccion) return false;
    return dentroDeLaVentana(new Date(c.ultima_interaccion), new Date());
  }
}
