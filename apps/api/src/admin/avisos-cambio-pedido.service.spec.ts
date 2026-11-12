import type { AvisosPedidoService } from '../mensajeria/avisos-pedido.service';
import type { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import type { ConversionesSocialService } from '../mensajeria/conversiones-social.service';
import { AvisosCambioPedidoService } from './avisos-cambio-pedido.service';
import type { PedidoAdminDto } from './pedidos-admin.tipos';

function crearServicio() {
  const avisosPedido = { notificarEstado: jest.fn() };
  const conversionesMeta = { avisarCompra: jest.fn() };
  const conversionesSocial = { avisarPedidoPorId: jest.fn() };
  const servicio = new AvisosCambioPedidoService(
    avisosPedido as unknown as AvisosPedidoService,
    conversionesMeta as unknown as ConversionesMetaService,
    conversionesSocial as unknown as ConversionesSocialService,
  );
  return { servicio, avisosPedido, conversionesMeta, conversionesSocial };
}

const PEDIDO = {
  id: 'ped-1',
  canal: 'whatsapp',
  total: 40000,
  cliente: { telefono: '573157861208' },
} as unknown as PedidoAdminDto;

describe('AvisosCambioPedidoService.avisar', () => {
  it('un pedido de Instagram entregado manda Purchase por la vía social', () => {
    const { servicio, conversionesMeta, conversionesSocial } = crearServicio();

    servicio.avisar(
      { ...PEDIDO, canal: 'instagram' },
      'entregado',
      'en_camino',
    );

    expect(conversionesSocial.avisarPedidoPorId).toHaveBeenCalledWith(
      'Purchase',
      'ped-1',
    );
    expect(conversionesMeta.avisarCompra).not.toHaveBeenCalled();
  });

  it('un pedido de Messenger cancelado manda OrderCanceled', () => {
    const { servicio, conversionesSocial } = crearServicio();

    servicio.avisar(
      { ...PEDIDO, canal: 'messenger' },
      'cancelado',
      'pendiente',
    );

    expect(conversionesSocial.avisarPedidoPorId).toHaveBeenCalledWith(
      'OrderCanceled',
      'ped-1',
    );
  });

  it('un pedido de WhatsApp no pasa por la vía social', () => {
    const { servicio, conversionesSocial } = crearServicio();

    servicio.avisar(PEDIDO, 'entregado', 'en_camino');

    expect(conversionesSocial.avisarPedidoPorId).not.toHaveBeenCalled();
  });

  it('sin cambio de estado no avisa a nadie', () => {
    const { servicio, avisosPedido, conversionesMeta } = crearServicio();

    servicio.avisar(PEDIDO, undefined, 'pendiente');
    servicio.avisar(PEDIDO, 'pendiente', 'pendiente');

    expect(avisosPedido.notificarEstado).not.toHaveBeenCalled();
    expect(conversionesMeta.avisarCompra).not.toHaveBeenCalled();
  });

  it('un cambio de estado le avisa al cliente', () => {
    const { servicio, avisosPedido, conversionesMeta } = crearServicio();

    servicio.avisar(PEDIDO, 'en_preparacion', 'confirmado');

    expect(avisosPedido.notificarEstado).toHaveBeenCalledWith('ped-1');
    expect(conversionesMeta.avisarCompra).not.toHaveBeenCalled();
  });

  it('entregar un pedido del bot manda la compra a Meta', () => {
    const { servicio, conversionesMeta } = crearServicio();

    servicio.avisar(PEDIDO, 'entregado', 'en_camino');

    expect(conversionesMeta.avisarCompra).toHaveBeenCalledWith({
      telefono: '573157861208',
      pedidoId: 'ped-1',
      total: 40000,
    });
  });

  it('entregar un pedido de otro canal no manda la compra a Meta', () => {
    const { servicio, conversionesMeta } = crearServicio();

    servicio.avisar({ ...PEDIDO, canal: 'pos' }, 'entregado', 'en_camino');

    expect(conversionesMeta.avisarCompra).not.toHaveBeenCalled();
  });
});
