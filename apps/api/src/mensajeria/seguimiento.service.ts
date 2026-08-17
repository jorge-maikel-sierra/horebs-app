import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

// Ambos plazos quedan bien adentro de la ventana gratis de 24h de WhatsApp
// (mensajes de sesión) — pasado ese límite, reenganchar a un cliente
// requiere una plantilla paga aprobada por Meta, que este módulo no
// implementa a propósito (ver README). Por eso el seguimiento no insiste
// más allá de la oferta.
const HORAS_PARA_RECORDATORIO = 3;
const HORAS_DE_RECORDATORIO_A_OFERTA = 6; // total: 9h desde el último mensaje
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

  @Cron('*/10 * * * *')
  async ejecutar(): Promise<void> {
    await this.enviarRecordatorios();
    await this.enviarOfertas();
  }

  private async enviarRecordatorios(): Promise<void> {
    const candidatas = await this.conversaciones.buscarInactivasSinSeguimiento(
      HORAS_PARA_RECORDATORIO,
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

  private async enviarOfertas(): Promise<void> {
    const candidatas = await this.conversaciones.buscarConRecordatorioVencido(
      HORAS_DE_RECORDATORIO_A_OFERTA,
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
