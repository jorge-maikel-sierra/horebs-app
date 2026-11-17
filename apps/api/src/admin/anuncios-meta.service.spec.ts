/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- mocks de jest y fetch */
import { AnunciosMetaService } from './anuncios-meta.service';

function crearServicio(configurado: boolean) {
  const guardados: unknown[][] = [];
  const upsert = jest.fn(async (lote: unknown[]) => {
    guardados.push(lote);
    return { error: null };
  });
  const supabase = { getClient: () => ({ from: () => ({ upsert }) }) };
  const valores = new Map(
    configurado
      ? Object.entries({
          META_AD_ACCOUNT_ID: '123',
          META_ADS_ACCESS_TOKEN: 'tok',
        })
      : [],
  );
  const config = { get: (k: string) => valores.get(k) };
  const servicio = new AnunciosMetaService(config as never, supabase as never);
  return { servicio, upsert, guardados };
}

const INSIGHT = {
  date_start: '2026-11-10',
  ad_id: 'a-1',
  campaign_id: 'c-1',
  spend: '100',
};

describe('AnunciosMetaService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  it('sin cuenta o token queda apagado y no llama a Meta', async () => {
    const { servicio, upsert } = crearServicio(false);
    const r = await servicio.sincronizar('2026-11-01');
    expect(r).toMatchObject({ estado: 'apagado', filas: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('trae todas las páginas con el token en el encabezado y guarda con upsert', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [INSIGHT],
          paging: { next: 'https://graph.facebook.com/siguiente' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ ...INSIGHT, ad_id: 'a-2' }] }),
      });
    const { servicio, guardados } = crearServicio(true);

    const r = await servicio.sincronizar('2026-11-01');

    expect(r).toMatchObject({ estado: 'sincronizado', filas: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(guardados[0]).toHaveLength(2);
  });

  it('si Meta responde con error lanza y no guarda nada', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad',
    });
    const { servicio, upsert } = crearServicio(true);
    await expect(servicio.sincronizar('2026-11-01')).rejects.toThrow(
      'Marketing API 400',
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('el cron nunca lanza aunque Meta falle', async () => {
    fetchMock.mockRejectedValue(new Error('red caída'));
    const { servicio } = crearServicio(true);
    await expect(servicio.sincronizarCadaDia()).resolves.toBeUndefined();
  });
});
