import { MailService } from '../mail/mail.service';
import { PedidosComprobantesService } from '../pedidos/pedidos-comprobantes.service';
import {
  ComprobantesService,
  type ProcesarComprobanteInput,
} from './comprobantes.service';
import { ConversacionesService } from './conversaciones.service';
import { MetaGraphService } from './meta-graph.service';

describe('ComprobantesService', () => {
  const PEDIDO_FICTICIO = {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    total: 45000,
    nombre: 'Carlos',
  };

  function crear(
    opciones: {
      pedido?: typeof PEDIDO_FICTICIO | null;
      mime?: string;
    } = {},
  ) {
    const pedidos = {
      pedidoEsperandoComprobante: jest
        .fn()
        .mockResolvedValue(
          opciones.pedido !== undefined ? opciones.pedido : PEDIDO_FICTICIO,
        ),
      guardarComprobante: jest.fn().mockResolvedValue('comprobantes/a1b2.jpg'),
      urlFirmada: jest
        .fn()
        .mockResolvedValue('https://storage.supabase.co/signed/a1b2.jpg'),
    };
    const conversaciones = {
      registrarMensaje: jest.fn().mockResolvedValue(undefined),
    };
    const metaGraph = {
      descargarMedia: jest.fn().mockResolvedValue({
        datos: Buffer.from('fake-data'),
        mime: opciones.mime ?? 'image/jpeg',
      }),
      enviarMensajeSesion: jest.fn().mockResolvedValue(undefined),
    };
    const mail = {
      enviarAvisoEquipo: jest.fn(),
    };

    const servicio = new ComprobantesService(
      pedidos as unknown as PedidosComprobantesService,
      conversaciones as unknown as ConversacionesService,
      metaGraph as unknown as MetaGraphService,
      mail as unknown as MailService,
    );

    return { servicio, pedidos, conversaciones, metaGraph, mail };
  }

  const BASE_INPUT: ProcesarComprobanteInput = {
    identificadorExterno: 'psid-12345',
    conversacionId: 'conv-1',
    mensajeId: 'mid.1',
    mediaId: 'https://cdn.example.com/receipt.jpg',
  };

  it('usa telefono para buscar el pedido si está presente', async () => {
    const { servicio, pedidos } = crear();

    const resultado = await servicio.procesar({
      ...BASE_INPUT,
      telefono: '3157861208',
      canal: 'messenger',
    });

    expect(resultado).toBe(true);
    expect(pedidos.pedidoEsperandoComprobante).toHaveBeenCalledWith(
      '3157861208',
    );
  });

  it('hace fallback a identificadorExterno si telefono no está presente', async () => {
    const { servicio, pedidos } = crear();

    const resultado = await servicio.procesar({
      ...BASE_INPUT,
      canal: 'whatsapp',
    });

    expect(resultado).toBe(true);
    expect(pedidos.pedidoEsperandoComprobante).toHaveBeenCalledWith(
      'psid-12345',
    );
  });

  it('envía la respuesta por el canal especificado en el input', async () => {
    const { servicio, metaGraph } = crear();

    await servicio.procesar({
      ...BASE_INPUT,
      canal: 'instagram',
      telefono: '3157861208',
    });

    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'instagram',
      'psid-12345',
      expect.stringContaining('¡Recibido el comprobante'),
    );
  });

  it('por defecto envía la respuesta por whatsapp si canal es indefinido', async () => {
    const { servicio, metaGraph } = crear();

    await servicio.procesar(BASE_INPUT);

    expect(metaGraph.enviarMensajeSesion).toHaveBeenCalledWith(
      'whatsapp',
      'psid-12345',
      expect.stringContaining('¡Recibido el comprobante'),
    );
  });

  it('devuelve false si el cliente no tiene un pedido esperando comprobante', async () => {
    const { servicio, metaGraph } = crear({ pedido: null });

    const resultado = await servicio.procesar(BASE_INPUT);

    expect(resultado).toBe(false);
    expect(metaGraph.descargarMedia).not.toHaveBeenCalled();
  });

  it('devuelve false si el archivo descargado no es un comprobante válido', async () => {
    const { servicio, pedidos } = crear({ mime: 'application/json' });

    const resultado = await servicio.procesar(BASE_INPUT);

    expect(resultado).toBe(false);
    expect(pedidos.guardarComprobante).not.toHaveBeenCalled();
  });
});
