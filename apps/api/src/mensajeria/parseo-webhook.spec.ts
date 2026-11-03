import {
  carritoDesdeOrden,
  entradaCheckoutDe,
  parsearMessengerOInstagram,
  parsearWhatsapp,
  textoCarritoCatalogo,
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

  it('en Instagram ignora is_self y is_deleted', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'a' },
                message: { text: 'propio', is_self: true },
              },
              {
                sender: { id: 'b' },
                message: { text: 'borrado', is_deleted: true },
              },
            ],
          },
        ],
      },
      'instagram',
    );
    expect(eventos).toEqual([]);
  });

  it('procesa quick_reply y postback con payload de checkout o botón pedir', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'user-1' },
                message: {
                  text: '🛵 Domicilio',
                  quick_reply: { payload: 'ck:mod:domicilio' },
                },
              },
              {
                sender: { id: 'user-2' },
                postback: {
                  payload: 'pedir:Pizza Pepperoni',
                  title: 'Agregar',
                },
              },
            ],
          },
        ],
      },
      'messenger',
    );
    expect(eventos[0]?.entrada).toEqual({
      tipo: 'boton',
      id: 'ck:mod:domicilio',
    });
    expect(eventos[0]?.texto).toBe('🛵 Domicilio');
    expect(eventos[1]?.texto).toBe('Quiero pedir Pizza Pepperoni');
  });

  it('procesa attachments de imagen, audio y ubicación', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'user-3' },
                message: {
                  attachments: [
                    {
                      type: 'image',
                      payload: { url: 'https://cdn.fb.com/foto.jpg' },
                    },
                  ],
                },
              },
              {
                sender: { id: 'user-4' },
                message: {
                  attachments: [
                    {
                      type: 'audio',
                      payload: { url: 'https://cdn.fb.com/audio.mp4' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      'instagram',
    );
    expect(eventos[0]?.media).toEqual({
      id: 'https://cdn.fb.com/foto.jpg',
      tipo: 'imagen',
    });
    expect(eventos[1]?.media).toEqual({
      id: 'https://cdn.fb.com/audio.mp4',
      tipo: 'audio',
    });
  });

  it('agrega contexto a respuestas de historias y no rompe con reels compartidos', () => {
    const eventos = parsearMessengerOInstagram(
      {
        entry: [
          {
            messaging: [
              {
                sender: { id: 'user-5' },
                message: {
                  text: '¿Cuánto vale?',
                  reply_to: { story: { id: 'story-1' } },
                },
              },
              {
                sender: { id: 'user-6' },
                message: {
                  attachments: [{ type: 'reel' }],
                },
              },
            ],
          },
        ],
      },
      'instagram',
    );
    expect(eventos[0]?.texto).toBe('[Respuesta a historia] ¿Cuánto vale?');
    expect(eventos[1]?.texto).toBe(
      'El cliente compartió contenido de Instagram.',
    );
  });

  it('valida object y entry.id esperados', () => {
    const payload = {
      object: 'page',
      entry: [
        {
          id: 'page-123',
          messaging: [{ sender: { id: 'u1' }, message: { text: 'Hola' } }],
        },
      ],
    };
    expect(
      parsearMessengerOInstagram(payload, 'messenger', 'page-123').length,
    ).toBe(1);
    expect(
      parsearMessengerOInstagram(payload, 'messenger', 'otra-pagina').length,
    ).toBe(0);
    expect(parsearMessengerOInstagram(payload, 'instagram').length).toBe(0); // object es page, no instagram
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

const HAWAIANA_GRANDE = {
  varianteId: 'var-1',
  productoNombre: 'Pizza Hawaiana',
  varianteNombre: 'Grande',
  conTamanos: true,
  cantidad: 2,
  precio: 42000,
};

describe('carritoDesdeOrden', () => {
  it('toma el id de la variante y la cantidad, y nunca el precio', () => {
    const carrito = carritoDesdeOrden({
      catalog_id: 'cat-1',
      product_items: [
        {
          product_retailer_id: 'var-1',
          quantity: 2,
          item_price: 1,
          currency: 'COP',
        } as never,
      ],
    });
    expect(carrito).toEqual({
      items: [{ varianteId: 'var-1', cantidad: 2 }],
      nota: null,
    });
  });

  it('acota la cantidad entre 1 y 20', () => {
    const { items } = carritoDesdeOrden({
      product_items: [
        { product_retailer_id: 'a', quantity: 500 },
        { product_retailer_id: 'b', quantity: 0 },
        { product_retailer_id: 'c', quantity: -3 },
      ],
    });
    expect(items.map((i) => i.cantidad)).toEqual([20, 1, 1]);
  });

  it('descarta ítems sin id y conserva la nota del cliente', () => {
    const carrito = carritoDesdeOrden({
      text: '  sin cebolla  ',
      product_items: [{ quantity: 1 }, { product_retailer_id: 'a' }],
    });
    expect(carrito.items).toEqual([{ varianteId: 'a', cantidad: 1 }]);
    expect(carrito.nota).toBe('sin cebolla');
  });
});

describe('textoCarritoCatalogo', () => {
  it('arma el pedido con tamaño solo cuando el producto tiene tamaños', () => {
    const texto = textoCarritoCatalogo(
      [
        HAWAIANA_GRANDE,
        {
          varianteId: 'var-2',
          productoNombre: 'Coca-Cola',
          varianteNombre: 'Única',
          conTamanos: false,
          cantidad: 1,
          precio: 4000,
        },
      ],
      0,
      null,
    );
    expect(texto).toBe(
      'Envié mi carrito del catálogo: 2x Pizza Hawaiana (Grande), 1x Coca-Cola.',
    );
  });

  it('avisa cuántos productos ya no están disponibles y agrega la nota', () => {
    const texto = textoCarritoCatalogo([HAWAIANA_GRANDE], 1, 'sin cebolla');
    expect(texto).toContain(
      '(1 producto(s) del carrito ya no están disponibles.)',
    );
    expect(texto).toContain('Nota: sin cebolla');
  });

  it('si nada está disponible lo dice sin inventar productos', () => {
    expect(textoCarritoCatalogo([], 2, null)).toContain(
      'ninguno de esos productos está disponible',
    );
  });
});

describe('entradaCheckoutDe', () => {
  it('un toque ck:* va al checkout con su título como texto', () => {
    expect(
      entradaCheckoutDe({
        type: 'interactive',
        from: '573001112233',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'ck:mod:domicilio', title: '🛵 Domicilio' },
        },
      }),
    ).toEqual({
      entrada: { tipo: 'boton', id: 'ck:mod:domicilio' },
      texto: '🛵 Domicilio',
    });
  });

  it('una fila de la lista de franjas también va al checkout', () => {
    expect(
      entradaCheckoutDe({
        type: 'interactive',
        from: '573001112233',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'ck:hora:18:30', title: '6:30 p.m.' },
        },
      }),
    ).toEqual({
      entrada: { tipo: 'boton', id: 'ck:hora:18:30' },
      texto: '6:30 p.m.',
    });
  });

  it('el botón "Agregar al pedido" de las tarjetas no es del checkout', () => {
    expect(
      entradaCheckoutDe({
        type: 'interactive',
        from: '573001112233',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'pedir:Pizza Hawaiana', title: 'Agregar' },
        },
      }),
    ).toBeNull();
  });

  it('una ubicación compartida se vuelve dirección con mapa', () => {
    const resultado = entradaCheckoutDe({
      type: 'location',
      from: '573001112233',
      location: { latitude: 11.54, longitude: -72.9, address: 'Cra 7 # 33-66' },
    });
    expect(resultado?.entrada).toMatchObject({
      tipo: 'ubicacion',
      latitud: 11.54,
      longitud: -72.9,
    });
    expect(resultado?.texto).toContain(
      'https://maps.google.com/?q=11.54,-72.9',
    );
  });

  it('el texto común no es una entrada de checkout', () => {
    expect(
      entradaCheckoutDe({
        type: 'text',
        from: '573001112233',
        text: { body: 'hola' },
      }),
    ).toBeNull();
  });
});
