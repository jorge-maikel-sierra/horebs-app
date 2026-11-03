import type { ConfigService } from '@nestjs/config';
import type { MailService } from '../mail/mail.service';
import { AvisoEquipoService, nombreCanalSocial } from './aviso-equipo.service';
import type { ConversacionesService } from './conversaciones.service';
import type { MetaGraphService } from './meta-graph.service';

interface AvisoCapturado {
  asunto: string;
  texto: string;
}

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
  const conversaciones = {
    listarMensajes: jest.fn().mockResolvedValue([]),
  };
  const servicio = new AvisoEquipoService(
    config as unknown as ConfigService,
    conversaciones as unknown as ConversacionesService,
    metaGraph as unknown as MetaGraphService,
    mail as unknown as MailService,
  );
  return { servicio, mail, metaGraph, conversaciones };
}

describe('nombreCanalSocial', () => {
  it('retorna nombres legibles para canales', () => {
    expect(nombreCanalSocial('messenger')).toBe('Messenger');
    expect(nombreCanalSocial('instagram')).toBe('Instagram');
    expect(nombreCanalSocial('whatsapp')).toBe('WhatsApp');
  });
});

describe('AvisoEquipoService.notificarVentanaCerrada', () => {
  it('envía correo al equipo con el motivo de ventana cerrada y marca advertencia', async () => {
    const { servicio, mail } = crear();

    servicio.notificarVentanaCerrada({
      canal: 'instagram',
      identificadorExterno: 'ig-999',
      telefono: '3187592616',
      conversacionId: 'conv-ig-1',
      pedidoId: 'abcd1234-5678',
      estadoPedido: 'confirmado',
    });

    await Promise.resolve();

    expect(mail.enviarAvisoEquipo).toHaveBeenCalledTimes(1);
    const aviso = (mail.enviarAvisoEquipo.mock.calls[0] as [AvisoCapturado])[0];
    expect(aviso.asunto).toContain('⚠️');
    expect(aviso.texto).toContain('ventana cerrada');
  });

  it('notifica ventana cerrada sin pedidoId ni estado', async () => {
    const { servicio, mail } = crear();

    servicio.notificarVentanaCerrada({
      canal: 'messenger',
      identificadorExterno: 'psid-888',
      telefono: null,
    });

    await Promise.resolve();

    expect(mail.enviarAvisoEquipo).toHaveBeenCalledTimes(1);
    const aviso = (mail.enviarAvisoEquipo.mock.calls[0] as [AvisoCapturado])[0];
    expect(aviso.asunto).toContain('⚠️');
    expect(aviso.texto).toContain('Messenger');
  });
});

describe('AvisoEquipoService.notificar', () => {
  it('con motivo específico lo propaga al correo y al WhatsApp de cocina', async () => {
    const { servicio, mail, metaGraph } = crear();

    servicio.notificar({
      canal: 'whatsapp',
      identificadorExterno: '573187592616',
      telefono: '573187592616',
      conversacionId: 'conv-wa-1',
      motivo: 'Fallo al procesar pedido',
    });

    await Promise.resolve();

    expect(mail.enviarAvisoEquipo).toHaveBeenCalledTimes(1);
    const aviso = (mail.enviarAvisoEquipo.mock.calls[0] as [AvisoCapturado])[0];
    expect(aviso.asunto).toContain('⚠️');
    expect(aviso.texto).toContain('Fallo al procesar pedido');
    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalled();
  });
});

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
