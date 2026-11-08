import {
  armarGenericTemplateSocial,
  armarQuickRepliesSocial,
  armarSenderActionSocial,
  armarTextoSocial,
  elementosDeTarjetas,
  esErrorBusinessAi,
  sinNegritasDeWhatsapp,
} from './mensajes-meta-social';

describe('mensajes-meta-social', () => {
  it('arma mensaje de texto plano', () => {
    const payload = armarTextoSocial('psid-1', 'Hola mundo');
    expect(payload).toEqual({
      recipient: { id: 'psid-1' },
      messaging_type: 'RESPONSE',
      message: { text: 'Hola mundo' },
    });
  });

  it('quita la negrita de WhatsApp porque Messenger e Instagram la muestran literal', () => {
    expect(sinNegritasDeWhatsapp('Total: *$42.000* y **listo**')).toBe(
      'Total: $42.000 y listo',
    );
    expect(sinNegritasDeWhatsapp('5 * 3 sin cierre')).toBe('5 * 3 sin cierre');
    const texto = armarTextoSocial('psid-1', 'Tu pedido *#AB12* va en camino');
    expect(texto).toMatchObject({
      message: { text: 'Tu pedido #AB12 va en camino' },
    });
    const opciones = armarQuickRepliesSocial('psid-1', '¿Cómo pagas? *Elige*', [
      { id: 'a', titulo: 'Efectivo' },
    ]);
    expect(opciones).toMatchObject({
      message: { text: '¿Cómo pagas? Elige' },
    });
  });

  it('arma quick replies con recorte de títulos y límite de 13', () => {
    const opciones = Array.from({ length: 15 }, (_, i) => ({
      id: `opt-${i}`,
      titulo: `Opción muy larga número ${i}`,
    }));
    const payload = armarQuickRepliesSocial(
      'psid-2',
      'Elige una opción:',
      opciones,
    ) as {
      message: {
        quick_replies: {
          content_type: string;
          title: string;
          payload: string;
        }[];
      };
    };
    expect(payload.message.quick_replies.length).toBe(13);
    expect(payload.message.quick_replies[0]?.title.length).toBeLessThanOrEqual(
      20,
    );
  });

  it('incluye botón de teléfono nativo en Messenger cuando se solicita', () => {
    const payload = armarQuickRepliesSocial(
      'psid-3',
      'Tu teléfono:',
      [],
      true,
    ) as {
      message: { quick_replies: { content_type: string }[] };
    };
    expect(payload.message.quick_replies[0]).toEqual({
      content_type: 'user_phone_number',
    });
  });

  it('la tarjeta muestra el precio primero y después la descripción, dentro de los 80 caracteres', () => {
    const [elemento] = elementosDeTarjetas([
      {
        nombre: 'Pizza Hawaiana',
        descripcion:
          'Combinación de sabores dulces y salados: jamón curado y piña jugosa sobre queso derretido.',
        precioDesde: 20000,
        imagenUrl: null,
      },
    ]);
    expect(elemento.subtitle?.startsWith('Desde $20.000 · Combinación')).toBe(
      true,
    );
    expect(elemento.subtitle?.length).toBeLessThanOrEqual(80);
  });

  it('arma generic template con postback "Agregar al pedido"', () => {
    const elementos = elementosDeTarjetas([
      {
        nombre: 'Pizza Especial Horebs',
        descripcion: null,
        precioDesde: 45000,
        imagenUrl: 'https://horebs.shop/foto.jpg',
      },
    ]);
    const payload = armarGenericTemplateSocial('psid-4', elementos) as {
      message: {
        attachment: {
          payload: {
            elements: {
              title: string;
              subtitle: string;
              image_url: string;
              buttons: { type: string; title: string; payload: string }[];
            }[];
          };
        };
      };
    };
    expect(payload.message.attachment.payload.elements[0]).toEqual({
      title: 'Pizza Especial Horebs',
      subtitle: 'Desde $45.000',
      image_url: 'https://horebs.shop/foto.jpg',
      buttons: [
        {
          type: 'postback',
          title: 'Agregar al pedido',
          payload: 'pedir:Pizza Especial Horebs',
        },
      ],
    });
  });

  it('arma sender action para mark_seen y typing_on', () => {
    expect(armarSenderActionSocial('psid-5', 'mark_seen')).toEqual({
      recipient: { id: 'psid-5' },
      sender_action: 'mark_seen',
    });
    expect(armarSenderActionSocial('psid-5', 'typing_on')).toEqual({
      recipient: { id: 'psid-5' },
      sender_action: 'typing_on',
    });
  });

  it('detecta error 100 con subcódigo 2534037 de Business AI', () => {
    expect(
      esErrorBusinessAi({
        error: { code: 100, error_subcode: 2534037, message: 'Business AI' },
      }),
    ).toBe(true);
    expect(
      esErrorBusinessAi({
        error: { code: 100, error_subcode: 1234, message: 'Otro' },
      }),
    ).toBe(false);
    expect(esErrorBusinessAi(null)).toBe(false);
  });
});
