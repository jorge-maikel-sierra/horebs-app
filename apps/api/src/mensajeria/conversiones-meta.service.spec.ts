/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await -- mocks de jest y fetch */
import {
  ConversionesMetaService,
  waIdColombia,
} from './conversiones-meta.service';

type Fila = { evento: string; referencia_id: string };

function crearServicio(
  opciones: {
    configurado?: boolean;
    ctwa?: { id: string; ctwaClid: string } | null;
  } = {},
) {
  const { configurado = true, ctwa = { id: 'conv-1', ctwaClid: 'CLID-123' } } =
    opciones;
  const claves: Fila[] = [];
  let ultimoDelete: Fila | null = null;

  const tabla = {
    insert: jest.fn(async (fila: Fila) => {
      const existe = claves.some(
        (c) =>
          c.evento === fila.evento && c.referencia_id === fila.referencia_id,
      );
      if (existe) return { error: { code: '23505' } };
      claves.push(fila);
      return { error: null };
    }),
    delete: jest.fn(() => ({
      eq: (_c1: string, evento: string) => ({
        eq: async (_c2: string, referencia: string) => {
          ultimoDelete = { evento, referencia_id: referencia };
          const i = claves.findIndex(
            (c) => c.evento === evento && c.referencia_id === referencia,
          );
          if (i >= 0) claves.splice(i, 1);
          return { error: null };
        },
      }),
    })),
  };
  const supabase = { getClient: () => ({ from: () => tabla }) };
  const conversaciones = { obtenerCtwa: jest.fn().mockResolvedValue(ctwa) };
  const valores: Record<string, string> = configurado
    ? {
        META_CAPI_ACCESS_TOKEN: 'tok',
        META_DATASET_ID: 'ds-1',
        WHATSAPP_BUSINESS_ACCOUNT_ID: 'waba-1',
      }
    : {};
  const config = { get: (k: string) => valores[k] };

  const servicio = new ConversionesMetaService(
    config as never,
    supabase as never,
    conversaciones as never,
  );
  return {
    servicio,
    conversaciones,
    claves,
    getUltimoDelete: () => ultimoDelete,
  };
}

describe('waIdColombia', () => {
  it('agrega el indicativo 57 a un teléfono local de 10 dígitos', () => {
    expect(waIdColombia('3157861208')).toBe('573157861208');
  });
  it('acepta formatos con espacios, + y prefijo de país', () => {
    expect(waIdColombia('+57 315 786 1208')).toBe('573157861208');
  });
  it('devuelve null si no hay teléfono utilizable', () => {
    expect(waIdColombia(null)).toBeNull();
    expect(waIdColombia('12345')).toBeNull();
  });
});

describe('ConversionesMetaService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as never;
  });

  it('envía Purchase con ctwa_clid, WABA, valor y moneda a business_messaging', async () => {
    const { servicio, conversaciones } = crearServicio();
    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 45000,
    });

    expect(conversaciones.obtenerCtwa).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/ds-1/events');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const evento = JSON.parse(init.body).data[0];
    expect(evento).toMatchObject({
      event_name: 'Purchase',
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        whatsapp_business_account_id: 'waba-1',
        ctwa_clid: 'CLID-123',
      },
      custom_data: { currency: 'COP', value: 45000 },
    });
  });

  it('no manda el mismo pedido dos veces (Meta no deduplica)', async () => {
    const { servicio } = crearServicio();
    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 1000,
    });
    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 1000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('no envía nada si la conversación no vino de un anuncio', async () => {
    const { servicio } = crearServicio({ ctwa: null });
    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 1000,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('LeadSubmitted no lleva custom_data y solo aplica a WhatsApp', async () => {
    const { servicio } = crearServicio();
    await servicio.notificarLead('messenger', 'psid-1');
    expect(fetchMock).not.toHaveBeenCalled();

    await servicio.notificarLead('whatsapp', '573157861208');
    const evento = JSON.parse(fetchMock.mock.calls[0][1].body).data[0];
    expect(evento.event_name).toBe('LeadSubmitted');
    expect(evento.custom_data).toBeUndefined();
  });

  it('si Meta rechaza el evento, no lanza y libera la clave para reintentar', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad',
    });
    const { servicio, claves, getUltimoDelete } = crearServicio();

    await expect(
      servicio.notificarCompra({
        telefono: '3157861208',
        pedidoId: 'ped-1',
        total: 1000,
      }),
    ).resolves.toBeUndefined();
    expect(getUltimoDelete()).toEqual({
      evento: 'Purchase',
      referencia_id: 'ped-1',
    });
    expect(claves).toHaveLength(0);

    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 1000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sin configuración completa queda apagado y no llama a Meta', async () => {
    const { servicio, conversaciones } = crearServicio({ configurado: false });
    await servicio.notificarCompra({
      telefono: '3157861208',
      pedidoId: 'ped-1',
      total: 1000,
    });
    expect(conversaciones.obtenerCtwa).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
