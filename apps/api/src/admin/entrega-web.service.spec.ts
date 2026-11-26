import type { MailService } from '../mail/mail.service';
import type { ConversionesWebService } from '../mensajeria/conversiones-web.service';
import { EntregaWebService } from './entrega-web.service';
import type { PedidoAdminDto } from './pedidos-admin.tipos';

function crear() {
  const conversionesWeb = { avisarCompra: jest.fn() };
  const mail = { enviarInvitacionResena: jest.fn() };
  const servicio = new EntregaWebService(
    conversionesWeb as unknown as ConversionesWebService,
    mail as unknown as MailService,
  );
  return { servicio, conversionesWeb, mail };
}

const PEDIDO = {
  id: 'ped-1',
  canal: 'web',
  cliente: { nombre: 'Ana', correo: 'ana@correo.co' },
} as unknown as PedidoAdminDto;

describe('EntregaWebService.avisarEntrega', () => {
  it('manda el Purchase y la invitación a reseñar al correo del cliente', () => {
    const { servicio, conversionesWeb, mail } = crear();

    servicio.avisarEntrega(PEDIDO);

    expect(conversionesWeb.avisarCompra).toHaveBeenCalledWith('ped-1');
    expect(mail.enviarInvitacionResena).toHaveBeenCalledWith({
      correo: 'ana@correo.co',
      nombre: 'Ana',
      pedidoId: 'ped-1',
    });
  });

  it('sin correo no manda la invitación, pero sí el Purchase', () => {
    const { servicio, conversionesWeb, mail } = crear();

    servicio.avisarEntrega({
      ...PEDIDO,
      cliente: { ...PEDIDO.cliente, correo: null },
    });

    expect(conversionesWeb.avisarCompra).toHaveBeenCalledWith('ped-1');
    expect(mail.enviarInvitacionResena).not.toHaveBeenCalled();
  });
});
