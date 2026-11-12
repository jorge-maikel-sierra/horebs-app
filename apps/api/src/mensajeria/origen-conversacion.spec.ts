import {
  origenDeProcedencia,
  payloadOrigenPedido,
  payloadPrimerOrigen,
  payloadUltimoOrigen,
  type FilaOrigenConversacion,
} from './origen-conversacion';
import {
  parsearMessengerOInstagram,
  parsearReferidosSociales,
  type MessengerWebhookPayload,
} from './parseo-webhook';

const AHORA = '2026-11-12T18:00:00.000Z';

const FILA_VACIA: FilaOrigenConversacion = {
  id: 'conv-1',
  origen_fuente: null,
  origen_anuncio_id: null,
  origen_ref: null,
  ultimo_origen_fuente: null,
  ultimo_anuncio_id: null,
  ultimo_ref: null,
};

describe('origenDeProcedencia', () => {
  it('sin referral no hay origen', () => {
    expect(origenDeProcedencia(null)).toBeNull();
  });

  it('toma anuncio, ref y título del anuncio de Messenger', () => {
    expect(
      origenDeProcedencia({
        esAnuncio: true,
        anuncioId: 'ad-1',
        fuente: 'ADS',
        ref: ' promo ',
        tituloAnuncio: 'Pizza 2x1',
      }),
    ).toEqual({
      fuente: 'ADS',
      anuncioId: 'ad-1',
      ref: 'promo',
      titulo: 'Pizza 2x1',
    });
  });

  it('un enlace m.me con ref es origen aunque no sea anuncio', () => {
    expect(
      origenDeProcedencia({ esAnuncio: false, fuente: 'SHORTLINK', ref: 'qr' }),
    ).toEqual({
      fuente: 'SHORTLINK',
      anuncioId: null,
      ref: 'qr',
      titulo: null,
    });
  });

  it('un referral sin anuncio ni ref no se guarda', () => {
    expect(
      origenDeProcedencia({ esAnuncio: false, fuente: 'SHORTLINK' }),
    ).toBeNull();
  });

  it('en WhatsApp no confunde el ctwa_clid con un id de anuncio', () => {
    expect(
      origenDeProcedencia({
        esAnuncio: true,
        anuncioId: 'clid-1',
        ctwaClid: 'clid-1',
        fuente: 'ad',
      }),
    ).toEqual({ fuente: 'ad', anuncioId: null, ref: null, titulo: null });
  });

  it('recorta un ref demasiado largo', () => {
    const origen = origenDeProcedencia({
      esAnuncio: false,
      fuente: 'SHORTLINK',
      ref: 'x'.repeat(3000),
    });
    expect(origen?.ref).toHaveLength(500);
  });
});

describe('payloads de origen', () => {
  const origen = {
    fuente: 'ADS',
    anuncioId: 'ad-1',
    ref: 'promo',
    titulo: 'Pizza',
  };

  it('el primer toque lleva la fecha de captura', () => {
    expect(payloadPrimerOrigen(origen, AHORA)).toEqual({
      origen_fuente: 'ADS',
      origen_anuncio_id: 'ad-1',
      origen_ref: 'promo',
      origen_titulo: 'Pizza',
      origen_capturado_en: AHORA,
    });
  });

  it('el último toque va en sus propias columnas', () => {
    expect(payloadUltimoOrigen(origen, AHORA)).toEqual({
      ultimo_origen_fuente: 'ADS',
      ultimo_anuncio_id: 'ad-1',
      ultimo_ref: 'promo',
      ultimo_origen_en: AHORA,
    });
  });

  it('al pedido se copia el último toque', () => {
    expect(
      payloadOrigenPedido({
        ...FILA_VACIA,
        origen_fuente: 'SHORTLINK',
        origen_ref: 'qr',
        ultimo_origen_fuente: 'ADS',
        ultimo_anuncio_id: 'ad-2',
      }),
    ).toEqual({
      conversacion_id: 'conv-1',
      origen_fuente: 'ADS',
      origen_anuncio_id: 'ad-2',
      origen_ref: null,
    });
  });

  it('si no hay último toque, se copia el primero', () => {
    expect(
      payloadOrigenPedido({
        ...FILA_VACIA,
        origen_fuente: 'SHORTLINK',
        origen_ref: 'qr',
      }),
    ).toEqual({
      conversacion_id: 'conv-1',
      origen_fuente: 'SHORTLINK',
      origen_anuncio_id: null,
      origen_ref: 'qr',
    });
  });

  it('sin origen igual liga el pedido a su conversación', () => {
    expect(payloadOrigenPedido(FILA_VACIA)).toEqual({
      conversacion_id: 'conv-1',
      origen_fuente: null,
      origen_anuncio_id: null,
      origen_ref: null,
    });
  });

  it('sin conversación no hay nada que copiar', () => {
    expect(payloadOrigenPedido(null)).toBeNull();
  });
});

describe('referral de Messenger e Instagram en el parser', () => {
  const payload = (
    object: string,
    evento: Record<string, unknown>,
  ): MessengerWebhookPayload => ({
    object,
    entry: [{ id: 'cuenta-1', messaging: [evento] }],
  });

  it('el anuncio de Instagram llega dentro del mensaje, con ref y título', () => {
    const [evento] = parsearMessengerOInstagram(
      payload('instagram', {
        sender: { id: 'igsid-1' },
        message: {
          mid: 'm1',
          text: 'Hola',
          referral: {
            ref: 'promo',
            ad_id: 'ad-5',
            source: 'ADS',
            type: 'OPEN_THREAD',
            ads_context_data: { ad_title: 'Hawaiana' },
          },
        },
      }),
      'instagram',
    );

    expect(evento.procedenciaAnuncio).toEqual({
      esAnuncio: true,
      anuncioId: 'ad-5',
      fuente: 'ADS',
      ref: 'promo',
      tituloAnuncio: 'Hawaiana',
    });
  });

  it('el botón Empezar de un hilo nuevo trae el referral en el postback', () => {
    const [evento] = parsearMessengerOInstagram(
      payload('page', {
        sender: { id: 'psid-1' },
        postback: {
          payload: 'GET_STARTED',
          referral: {
            ref: 'qr_caja',
            source: 'SHORTLINK',
            type: 'OPEN_THREAD',
          },
        },
      }),
      'messenger',
    );

    expect(evento.procedenciaAnuncio?.ref).toBe('qr_caja');
  });

  it('el referral suelto no es un mensaje para responder, pero sí un referido', () => {
    const suelto = payload('page', {
      sender: { id: 'psid-2' },
      referral: { ad_id: 'ad-9', source: 'ADS', type: 'OPEN_THREAD' },
    });

    expect(parsearMessengerOInstagram(suelto, 'messenger')).toEqual([]);
    expect(parsearReferidosSociales(suelto, 'messenger')).toEqual([
      {
        canal: 'messenger',
        identificadorExterno: 'psid-2',
        procedencia: {
          esAnuncio: true,
          anuncioId: 'ad-9',
          fuente: 'ADS',
          ref: undefined,
          tituloAnuncio: undefined,
        },
      },
    ]);
  });

  it('un mensaje con referral no se cuenta dos veces como referido', () => {
    const conMensaje = payload('page', {
      sender: { id: 'psid-3' },
      message: { mid: 'm3', text: 'hola' },
      referral: { ad_id: 'ad-9', source: 'ADS' },
    });

    expect(parsearReferidosSociales(conMensaje, 'messenger')).toEqual([]);
  });

  it('ignora referidos de otra cuenta', () => {
    const otra = payload('instagram', {
      sender: { id: 'igsid-9' },
      referral: { ref: 'bio', source: 'IGME' },
    });

    expect(parsearReferidosSociales(otra, 'instagram', 'mi-cuenta')).toEqual(
      [],
    );
  });
});
