/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await -- mocks de jest y fetch */
import {
  claveDiaria,
  diaBogota,
  payloadEventoSocial,
  userDataSocial,
} from './conversiones-social';
import { ConversionesSocialService } from './conversiones-social.service';

const CUENTAS = { pageId: 'page-1', instagramId: 'ig-1' };

describe('conversiones-social (puro)', () => {
  it('el día se calcula en Bogotá, no en UTC', () => {
    // 2 a.m. UTC del 13 = 9 p.m. del 12 en Bogotá.
    expect(diaBogota(new Date('2026-11-13T02:00:00Z'))).toBe('2026-11-12');
  });

  it('la clave diaria es un uuid estable por cliente y día', () => {
    const tarde = new Date('2026-11-12T22:00:00Z');
    const noche = new Date('2026-11-13T03:00:00Z');
    const manana = new Date('2026-11-13T15:00:00Z');
    const clave = claveDiaria('messenger', 'psid-1', tarde);

    expect(clave).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(claveDiaria('messenger', 'psid-1', noche)).toBe(clave);
    expect(claveDiaria('messenger', 'psid-1', manana)).not.toBe(clave);
    expect(claveDiaria('instagram', 'psid-1', tarde)).not.toBe(clave);
  });

  it('Messenger se identifica con página + PSID', () => {
    expect(userDataSocial('messenger', 'psid-1', CUENTAS)).toEqual({
      page_id: 'page-1',
      page_scoped_user_id: 'psid-1',
    });
  });

  it('Instagram se identifica con la cuenta + IGSID', () => {
    expect(userDataSocial('instagram', 'igsid-1', CUENTAS)).toEqual({
      instagram_business_account_id: 'ig-1',
      ig_sid: 'igsid-1',
    });
  });

  it('sin la cuenta del negocio no hay a quién atribuir', () => {
    expect(userDataSocial('instagram', 'igsid-1', { pageId: 'p' })).toBeNull();
    expect(userDataSocial('messenger', 'psid-1', {})).toBeNull();
  });

  it('el evento lleva action_source de mensajería y el valor en COP', () => {
    const ahora = new Date('2026-11-12T22:00:00Z');
    expect(
      payloadEventoSocial({
        evento: 'Purchase',
        canal: 'messenger',
        userData: { page_id: 'p', page_scoped_user_id: 'u' },
        ahora,
        valor: 44000,
      }),
    ).toEqual({
      event_name: 'Purchase',
      event_time: Math.floor(ahora.getTime() / 1000),
      action_source: 'business_messaging',
      messaging_channel: 'messenger',
      user_data: { page_id: 'p', page_scoped_user_id: 'u' },
      custom_data: { currency: 'COP', value: 44000 },
    });
  });
});

function crearServicio(configurado = true, pedido?: Record<string, unknown>) {
  const claves = new Set<string>();
  const insertar = jest.fn(
    async (fila: { evento: string; referencia_id: string }) => {
      const k = `${fila.evento}:${fila.referencia_id}`;
      if (claves.has(k)) return { error: { code: '23505' } };
      claves.add(k);
      return { error: null };
    },
  );
  const consulta = (data: unknown) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
    }),
  });
  const tablas = new Map<string, unknown>(
    Object.entries({
      eventos_meta_enviados: {
        insert: insertar,
        delete: () => ({
          eq: (_c: string, evento: string) => ({
            eq: async (_c2: string, ref: string) => {
              claves.delete(`${evento}:${ref}`);
              return {};
            },
          }),
        }),
      },
      pedidos: consulta(pedido ?? null),
      conversaciones_bot: consulta({
        canal: 'instagram',
        identificador_externo: 'igsid-7',
      }),
    }),
  );
  const supabase = {
    getClient: () => ({ from: (t: string) => tablas.get(t) }),
  };
  const valores = new Map<string, string>(
    configurado
      ? Object.entries({
          META_EVENTS_ACCESS_TOKEN: 'tok',
          META_DATASET_ID_SOCIAL: 'ds-social',
          MESSENGER_PAGE_ID: 'page-1',
          INSTAGRAM_ACCOUNT_ID: 'ig-1',
        })
      : [],
  );
  const config = { get: (k: string) => valores.get(k) };
  const servicio = new ConversionesSocialService(
    config as never,
    supabase as never,
  );
  return { servicio, insertar };
}

const esperar = () => new Promise((r) => setImmediate(r));

describe('ConversionesSocialService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    global.fetch = fetchMock as never;
  });

  it('manda el evento al dataset social con el token en el header', async () => {
    const { servicio } = crearServicio();

    servicio.avisarConversacion('ViewContent', 'messenger', 'psid-1');
    await esperar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/ds-social/events');
    expect(url).not.toContain('tok');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const evento = JSON.parse(init.body).data[0];
    expect(evento.event_name).toBe('ViewContent');
    expect(evento.user_data.page_scoped_user_id).toBe('psid-1');
  });

  it('el mismo paso del embudo el mismo día sale una sola vez', async () => {
    const { servicio } = crearServicio();

    servicio.avisarConversacion('AddToCart', 'instagram', 'igsid-1');
    await esperar();
    servicio.avisarConversacion('AddToCart', 'instagram', 'igsid-1');
    await esperar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('WhatsApp no pasa por este servicio', async () => {
    const { servicio, insertar } = crearServicio();

    servicio.avisarConversacion('ViewContent', 'whatsapp', '573157861208');
    await esperar();

    expect(insertar).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin configuración queda apagado', async () => {
    const { servicio } = crearServicio(false);

    servicio.avisarConversacion('ViewContent', 'messenger', 'psid-1');
    await esperar();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('el Purchase desde el panel busca al cliente por la conversación del pedido', async () => {
    const { servicio } = crearServicio(true, {
      total: 44000,
      conversacion_id: 'conv-1',
    });

    servicio.avisarPedidoPorId('Purchase', 'ped-1');
    await esperar();
    await esperar();

    const evento = JSON.parse(fetchMock.mock.calls[0][1].body).data[0];
    expect(evento.event_name).toBe('Purchase');
    expect(evento.messaging_channel).toBe('instagram');
    expect(evento.user_data.ig_sid).toBe('igsid-7');
    expect(evento.custom_data).toEqual({ currency: 'COP', value: 44000 });
  });

  it('un pedido sin conversación ligada no manda nada', async () => {
    const { servicio } = crearServicio(true, {
      total: 44000,
      conversacion_id: null,
    });

    servicio.avisarPedidoPorId('Purchase', 'ped-1');
    await esperar();
    await esperar();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si Meta falla no lanza y permite reintentar', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad',
    });
    const { servicio } = crearServicio();

    servicio.avisarConversacion('InitiateCheckout', 'messenger', 'psid-1');
    await esperar();
    await esperar();
    servicio.avisarConversacion('InitiateCheckout', 'messenger', 'psid-1');
    await esperar();
    await esperar();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
