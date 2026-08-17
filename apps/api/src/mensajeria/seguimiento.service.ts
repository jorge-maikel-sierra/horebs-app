import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

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

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  // Nombre explícito: @nestjs/schedule genera uno con crypto.randomUUID()
  // si no se lo damos, y ese global no existe en el Node 18 de Railway.
  @Cron('*/10 * * * *', { name: 'seguimiento-conversaciones' })
  async ejecutar(): Promise<void> {
    const { recordatorioMinutos, ofertaMinutos } =
      await this.conversaciones.obtenerConfiguracionSeguimiento();
    await this.enviarRecordatorios(recordatorioMinutos);
    await this.enviarOfertas(ofertaMinutos);
  }

  private async enviarRecordatorios(minutosInactividad: number): Promise<void> {
    const candidatas = await this.conversaciones.buscarInactivasSinSeguimiento(
      minutosInactividad,
    );
    for (const c of candidatas) {
      try {
        await this.metaGraph.enviarMensajeSesion(c.canal, c.identificador_externo, TEXTO_RECORDATORIO);
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

  private async enviarOfertas(minutosDesdeRecordatorio: number): Promise<void> {
    const candidatas = await this.conversaciones.buscarConRecordatorioVencido(
      minutosDesdeRecordatorio,
    );
    for (const c of candidatas) {
      try {
        await this.metaGraph.enviarMensajeSesion(c.canal, c.identificador_externo, TEXTO_OFERTA);
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
