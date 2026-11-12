import {
  nombreParaMeta,
  payloadPurchaseWeb,
  sha256,
  telefonoParaMeta,
  userDataWeb,
  type PedidoWebParaEvento,
} from './conversiones-web';

const PEDIDO: PedidoWebParaEvento = {
  id: 'ped-1',
  total: 44000,
  clienteId: 'cli-1',
  cliente: {
    nombre: 'María José',
    apellido: 'Núñez',
    telefono: '315 786 1208',
    correo: ' Ana@Correo.CO ',
  },
  items: [{ varianteId: 'var-1', cantidad: 2 }],
  atribucion: {
    fbp: 'fb.1.1596403881668.1116446470',
    fbc: 'fb.1.1554763741205.AbCd',
    url: 'https://pizzeriahorebs.shop/checkout',
    ip: '181.50.1.2',
    user_agent: 'Mozilla/5.0',
  },
};

describe('conversiones-web', () => {
  it('el teléfono lleva el 57 y solo dígitos', () => {
    expect(telefonoParaMeta('315 786 1208')).toBe('573157861208');
    expect(telefonoParaMeta('+57 315-786-1208')).toBe('573157861208');
    expect(telefonoParaMeta('123')).toBeNull();
  });

  it('los nombres van en minúscula, sin espacios y con tildes', () => {
    expect(nombreParaMeta('María José')).toBe('maríajosé');
    expect(nombreParaMeta(' ')).toBeNull();
  });

  it('lo personal va con SHA-256 y lo técnico en claro', () => {
    const datos = userDataWeb(PEDIDO);
    expect(datos).toEqual({
      em: [sha256('ana@correo.co')],
      ph: [sha256('573157861208')],
      fn: [sha256('maríajosé')],
      ln: [sha256('núñez')],
      ct: [sha256('riohacha')],
      country: [sha256('co')],
      external_id: [sha256('cli-1')],
      client_ip_address: '181.50.1.2',
      client_user_agent: 'Mozilla/5.0',
      fbp: 'fb.1.1596403881668.1116446470',
      fbc: 'fb.1.1554763741205.AbCd',
    });
    expect(JSON.stringify(datos)).not.toContain('ana@correo.co');
  });

  it('sin navegador registrado no hay evento web posible', () => {
    expect(
      userDataWeb({ ...PEDIDO, atribucion: { ip: '1.1.1.1' } }),
    ).toBeNull();
    expect(userDataWeb({ ...PEDIDO, atribucion: null })).toBeNull();
  });

  it('el Purchase usa el id del pedido como event_id para deduplicar con el Pixel', () => {
    const ahora = new Date('2026-11-12T22:00:00Z');
    const evento = payloadPurchaseWeb(
      PEDIDO,
      { client_user_agent: 'x' },
      ahora,
    );
    expect(evento).toEqual({
      event_name: 'Purchase',
      event_time: Math.floor(ahora.getTime() / 1000),
      event_id: 'ped-1',
      action_source: 'website',
      event_source_url: 'https://pizzeriahorebs.shop/checkout',
      user_data: { client_user_agent: 'x' },
      custom_data: {
        currency: 'COP',
        value: 44000,
        order_id: 'ped-1',
        content_type: 'product',
        content_ids: ['var-1'],
        contents: [{ id: 'var-1', quantity: 2 }],
      },
    });
  });
});
