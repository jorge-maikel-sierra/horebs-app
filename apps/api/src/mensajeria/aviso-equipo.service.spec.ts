import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../mail/mail.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import type { ConversacionesService } from './conversaciones.service';
import type { MetaGraphService } from './meta-graph.service';

function crear(rechazaWhatsapp = false) {
  const mail = { enviarAvisoEquipo: jest.fn() };
  const metaGraph = {
    enviarMensajeSesion: rechazaWhatsapp
      ? jest.fn().mockRejectedValue(new Error('fuera de 24h'))
      : jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: (clave: string) =>
      clave === 'PERSONAL_COCINA_WHATSAPP'
        ? '3157861208, 573001112233'
        : undefined,
  };
  const servicio = new AvisoEquipoService(
    config as unknown as ConfigService,
    {} as ConversacionesService,
    metaGraph as unknown as MetaGraphService,
    mail as unknown as MailService,
  );
  return { servicio, mail, metaGraph };
}

describe('AvisoEquipoService.notificarPago', () => {
  const pedido = { pedidoId: 'abcdef12-3456', total: 65000 };

  it('avisa por correo y a cada número de la cocina que el pedido está pagado', () => {
    const { servicio, mail, metaGraph } = crear();

    servicio.notificarPago({ ...pedido, pagado: true });

    expect(mail.enviarAvisoEquipo).toHaveBeenCalledWith(
      expect.objectContaining({
        asunto: 'Pedido #abcdef12: PAGADO con tarjeta',
        texto: 'Pedido #abcdef12 por $65.000: PAGADO con tarjeta.',
      }),
    );
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledTimes(2);
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
      'Pedido #abcdef12 por $65.000: PAGADO con tarjeta.',
    );
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      '573001112233',
      expect.any(String),
    );
  });

  it('un pago rechazado también se avisa, con el estado claro', () => {
    const { servicio, mail } = crear();

    servicio.notificarPago({ ...pedido, pagado: false });

    expect(mail.enviarAvisoEquipo).toHaveBeenCalledWith(
      expect.objectContaining({ asunto: 'Pedido #abcdef12: pago RECHAZADO' }),
    );
  });

  it('si WhatsApp rechaza el mensaje no revienta (fire-and-forget)', async () => {
    const { servicio } = crear(true);

    expect(() =>
      servicio.notificarPago({ ...pedido, pagado: true }),
    ).not.toThrow();
    await Promise.resolve();
  });
});
