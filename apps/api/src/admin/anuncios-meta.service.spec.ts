/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- mocks de jest y fetch */
import { AnunciosMetaService } from './anuncios-meta.service';

function crearServicio(configurado: boolean) {
  const guardados = new Map<string, unknown[]>();
  const supabase = {
    getClient: () => ({
      from: (tabla: string) => ({
        upsert: async (lote: unknown[]) => {
          guardados.set(tabla, [...(guardados.get(tabla) ?? []), ...lote]);
          return { error: null };
        },
      }),
    }),
  };
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
  return { servicio, guardados };
}

const INSIGHT = {
  date_start: '2026-11-10',
  ad_id: 'a-1',
  campaign_id: 'c-1',
  spend: '100',
};

const respuesta = (cuerpo: object) => ({ ok: true, json: async () => cuerpo });

describe('AnunciosMetaService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  it('sin cuenta o token queda apagado y no llama a Meta', async () => {
    const { servicio, guardados } = crearServicio(false);
    const r = await servicio.sincronizar('2026-11-01');
    expect(r).toMatchObject({ estado: 'apagado', filas: 0, creativos: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(guardados.size).toBe(0);
  });

  it('trae todas las páginas de gasto y los creativos, con el token en el encabezado', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/ads?')) {
        return respuesta({ data: [{ id: 'a-1', name: 'Reel' }] });
      }
      if (url.includes('siguiente')) {
        return respuesta({ data: [{ ...INSIGHT, ad_id: 'a-2' }] });
      }
      return respuesta({
        data: [INSIGHT],
        paging: { next: 'https://graph.facebook.com/siguiente' },
      });
    });
    const { servicio, guardados } = crearServicio(true);

    const r = await servicio.sincronizar('2026-11-01');

    expect(r).toMatchObject({ estado: 'sincronizado', filas: 2, creativos: 1 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(guardados.get('anuncios_meta_diario')).toHaveLength(2);
    expect(guardados.get('anuncios_meta_creativos')).toHaveLength(1);
  });

  it('si fallan los creativos, el gasto igual queda guardado', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/ads?')
        ? { ok: false, status: 500, text: async () => 'boom' }
        : respuesta({ data: [INSIGHT] }),
    );
    const { servicio, guardados } = crearServicio(true);

    const r = await servicio.sincronizar('2026-11-01');

    expect(r).toMatchObject({ filas: 1, creativos: 0 });
    expect(guardados.get('anuncios_meta_diario')).toHaveLength(1);
  });

  it('si Meta rechaza el gasto lanza y no guarda nada', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad',
    });
    const { servicio, guardados } = crearServicio(true);
    await expect(servicio.sincronizar('2026-11-01')).rejects.toThrow(
      'Marketing API 400',
    );
    expect(guardados.size).toBe(0);
  });

  it('el cron nunca lanza aunque Meta falle', async () => {
    fetchMock.mockRejectedValue(new Error('red caída'));
    const { servicio } = crearServicio(true);
    await expect(servicio.sincronizarCadaDia()).resolves.toBeUndefined();
  });
});
