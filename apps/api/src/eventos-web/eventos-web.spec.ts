import { payloadEventoWeb, type EventoWebInput } from './eventos-web';

const AHORA = new Date('2026-11-23T22:00:00Z');
const HTTP = { ip: '181.49.1.2', userAgent: 'Mozilla/5.0' };
const VARIANTE = '6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const BASE: EventoWebInput = {
  event_name: 'ViewContent',
  event_id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  url: 'https://pizzeriahorebs.shop/producto/hawaiana?fbclid=abc',
};

describe('payloadEventoWeb', () => {
  it('arma el evento de sitio con IP, navegador, cookies y URL sin query', () => {
    expect(
      payloadEventoWeb(
        {
          ...BASE,
          fbp: 'fb.1.1596403881668.1116446470',
          value: 29000,
          content_ids: [VARIANTE, 'no-es-uuid', 7],
        },
        HTTP,
        AHORA,
      ),
    ).toStrictEqual({
      event_name: 'ViewContent',
      event_time: 1795471200,
      event_id: BASE.event_id,
      action_source: 'website',
      event_source_url: 'https://pizzeriahorebs.shop/producto/hawaiana',
      user_data: {
        client_ip_address: '181.49.1.2',
        client_user_agent: 'Mozilla/5.0',
        fbp: 'fb.1.1596403881668.1116446470',
      },
      custom_data: {
        currency: 'COP',
        value: 29000,
        content_type: 'product',
        content_ids: [VARIANTE],
      },
    });
  });

  it('sin valor ni productos no lleva custom_data', () => {
    const evento = payloadEventoWeb(
      { ...BASE, event_name: 'PageView' },
      HTTP,
      AHORA,
    );
    expect(evento).not.toHaveProperty('custom_data');
  });

  it('descarta una cookie con formato raro', () => {
    const evento = payloadEventoWeb({ ...BASE, fbc: 'basura' }, HTTP, AHORA);
    expect(evento?.user_data).not.toHaveProperty('fbc');
  });

  it('no manda nada sin navegador o con una URL de otro sitio', () => {
    expect(
      payloadEventoWeb(BASE, { ip: '1.1.1.1', userAgent: null }, AHORA),
    ).toBeNull();
    expect(
      payloadEventoWeb({ ...BASE, url: 'https://otro.com/x' }, HTTP, AHORA),
    ).toBeNull();
  });
});
