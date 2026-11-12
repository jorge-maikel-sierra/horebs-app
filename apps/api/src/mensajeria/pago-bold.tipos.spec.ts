import { destinoAvisoPago, type PedidoCobrado } from './pago-bold.tipos';

const BASE: PedidoCobrado = {
  id: 'ped-1',
  total: 44000,
  clientes: { nombre: 'Ana', telefono: '3157861208' },
  conversaciones_bot: null,
};

describe('destinoAvisoPago', () => {
  it('un pedido de Instagram se avisa por Instagram, no por WhatsApp', () => {
    expect(
      destinoAvisoPago({
        ...BASE,
        conversaciones_bot: {
          canal: 'instagram',
          identificador_externo: 'igsid-1',
        },
      }),
    ).toEqual({ canal: 'instagram', identificadorExterno: 'igsid-1' });
  });

  it('sin conversación ligada va por WhatsApp al teléfono del pedido', () => {
    expect(destinoAvisoPago(BASE)).toEqual({
      canal: 'whatsapp',
      identificadorExterno: '573157861208',
    });
  });

  it('sin conversación ni teléfono no hay a quién avisar', () => {
    expect(destinoAvisoPago({ ...BASE, clientes: null })).toBeNull();
  });
});
