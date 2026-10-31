import {
  parsearMessengerOInstagram,
  parsearWhatsapp,
  type WhatsappWebhookPayload,
} from './parseo-webhook';

const conMensajes = (
  mensajes: NonNullable<
    NonNullable<
      NonNullable<WhatsappWebhookPayload['entry']>[number]['changes']
    >[number]['value']
  >['messages'],
): WhatsappWebhookPayload => ({
  entry: [{ changes: [{ value: { messages: mensajes } }] }],
});

describe('parsearWhatsapp', () => {
  it('lee un texto con su teléfono y su id de mensaje', () => {
    const [evento] = parsearWhatsapp(
      conMensajes([
        {
          type: 'text',
          from: '573157861208',
          id: 'wamid.1',
          text: { body: 'Hola' },
        },
      ]),
    );
    expect(evento).toMatchObject({
      canal: 'whatsapp',
      identificadorExterno: '573157861208',
      telefono: '573157861208',
      texto: 'Hola',
      mensajeId: 'wamid.1',
      procedenciaAnuncio: null,
    });
  });

  it('el botón "Agregar al pedido" se vuelve una frase natural', () => {
    const [evento] = parsearWhatsapp(
      conMensajes([
        {
          type: 'interactive',
          from: '57315',
          interactive: {
            type: 'button_reply',
            button_reply: { id: 'pedir:Pizza Hawaiana', title: 'Agregar' },
          },
        },
      ]),
    );
    expect(evento.texto).toBe('Quiero pedir Pizza Hawaiana');
  });

  it('marca el anuncio cuando el mensaje trae referral', () => {
    const [evento] = parsearWhatsapp(
      conMensajes([
        {
          type: 'text',
          from: '57315',
          text: { body: 'Hola' },
          referral: { source_id: 'ad-1', ctwa_clid: 'clid-1' },
        },
      ]),
    );
    expect(evento.procedenciaAnuncio).toEqual({
      esAnuncio: true,
      anuncioId: 'ad-1',
      fuente: 'ad',
      ctwaClid: 'clid-1',
    });
  });

  it('ignora lo que el bot no sabe leer y los payloads vacíos', () => {
    expect(
      parsearWhatsapp(conMensajes([{ type: 'sticker', from: '57315' }])),
    ).toEqual([]);
    expect(parsearWhatsapp({})).toEqual([]);
  });
});

describe('parsearMessengerOInstagram', () => {
  it('lee un texto y no expone teléfono', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'psid-1' },
                message: { text: 'Hola', mid: 'm.1' },
              },
            ],
          },
        ],
      },
      'instagram',
    );
    expect(eventos).toEqual([
      {
        canal: 'instagram',
        identificadorExterno: 'psid-1',
        telefono: null,
        texto: 'Hola',
        procedenciaAnuncio: null,
        mensajeId: 'm.1',
      },
    ]);
  });

  it('ignora ecos del propio bot y eventos sin texto', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              { sender: { id: 'a' }, message: { text: 'eco', is_echo: true } },
              { sender: { id: 'b' }, message: {} },
            ],
          },
        ],
      },
      'messenger',
    );
    expect(eventos).toEqual([]);
  });

  it('detecta anuncio por source ADS', () => {
    const [evento] = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'a' },
                message: { text: 'Hola' },
                referral: { source: 'ADS', ad_id: 'ad-9' },
              },
            ],
          },
        ],
      },
      'messenger',
    );
    expect(evento.procedenciaAnuncio).toEqual({
      esAnuncio: true,
      anuncioId: 'ad-9',
      fuente: 'ADS',
    });
  });
});
