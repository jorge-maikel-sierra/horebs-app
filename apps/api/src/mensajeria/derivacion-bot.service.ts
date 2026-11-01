import { Injectable } from '@nestjs/common';
import { AvisoEquipoService, MENSAJE_DERIVACION } from './aviso-equipo.service';
import { ConversacionesService } from './conversaciones.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import type { ContextoHerramienta } from './herramientas-bot.service';

/**
 * Pasa la conversación a una persona: deja el hilo derivado, avisa al
 * equipo y le cuenta a Meta que hubo un lead. Devuelve lo que el modelo
 * debe decirle al cliente, que es siempre el mensaje fijo.
 */
@Injectable()
export class DerivacionBotService {
  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly avisoEquipo: AvisoEquipoService,
    private readonly conversionesMeta: ConversionesMetaService,
  ) {}

  async derivar(ctx: ContextoHerramienta): Promise<string> {
    const { canal, identificadorExterno, telefono, conversacionId } = ctx;
    await this.conversaciones.derivarAHumano(canal, identificadorExterno);
    this.avisoEquipo.notificar({
      canal,
      identificadorExterno,
      telefono,
      conversacionId,
    });
    this.conversionesMeta.avisarLead(canal, identificadorExterno);
    return `Conversación derivada. Respondé al cliente con este mensaje EXACTO, sin cambiarlo ni agregar nada de "confirmado" o tiempos de entrega: "${MENSAJE_DERIVACION}"`;
  }
}
