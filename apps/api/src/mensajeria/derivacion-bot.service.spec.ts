import {
  MENSAJE_DERIVACION,
  type AvisoEquipoService,
} from './aviso-equipo.service';
import type { ConversacionesService } from './conversaciones.service';
import type { ConversionesMetaService } from './conversiones-meta.service';
import { DerivacionBotService } from './derivacion-bot.service';

describe('DerivacionBotService.derivar', () => {
  it('deriva, avisa al equipo y a Meta, y devuelve el mensaje fijo', async () => {
    const conversaciones = {
      derivarAHumano: jest.fn().mockResolvedValue(undefined),
    };
    const avisoEquipo = { notificar: jest.fn() };
    const conversionesMeta = { avisarLead: jest.fn() };
    const servicio = new DerivacionBotService(
      conversaciones as unknown as ConversacionesService,
      avisoEquipo as unknown as AvisoEquipoService,
      conversionesMeta as unknown as ConversionesMetaService,
    );

    const texto = await servicio.derivar({
      canal: 'whatsapp',
      identificadorExterno: '573157861208',
      telefono: '573157861208',
      conversacionId: 'conv-1',
    });

    expect(conversaciones.derivarAHumano).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
    );
    expect(avisoEquipo.notificar).toHaveBeenCalledWith({
      canal: 'whatsapp',
      identificadorExterno: '573157861208',
      telefono: '573157861208',
      conversacionId: 'conv-1',
    });
    expect(conversionesMeta.avisarLead).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
    );
    expect(texto).toContain(MENSAJE_DERIVACION);
    expect(texto).toContain('EXACTO');
  });
});
