import { ServiceUnavailableException } from '@nestjs/common';
import {
  armarPerfilCanal,
  armarPerfilInstagram,
  armarPerfilMessenger,
  enviarPerfilMeta,
  ICE_BREAKERS_INSTAGRAM,
  ITEMS_MENU_MESSENGER,
} from './perfil-meta';

describe('perfil-meta', () => {
  it('arma perfil de Messenger con Get Started y menú persistente de hasta 5 ítems', () => {
    const perfil = armarPerfilMessenger() as {
      get_started: { payload: string };
      persistent_menu: {
        locale: string;
        call_to_actions: { title: string; payload: string }[];
      }[];
    };
    expect(perfil.get_started.payload).toBe('iniciar');
    expect(perfil.persistent_menu[0].locale).toBe('default');
    expect(
      perfil.persistent_menu[0].call_to_actions.length,
    ).toBeLessThanOrEqual(5);
    expect(perfil.persistent_menu[0].call_to_actions.length).toBe(
      ITEMS_MENU_MESSENGER.length,
    );
    for (const item of perfil.persistent_menu[0].call_to_actions) {
      expect(item.title.length).toBeLessThanOrEqual(30);
    }
  });

  it('arma perfil de Instagram con ice breakers de hasta 4 preguntas', () => {
    const perfil = armarPerfilInstagram() as {
      ice_breakers: {
        locale: string;
        call_to_actions: { question: string; payload: string }[];
      }[];
    };
    expect(perfil.ice_breakers[0].locale).toBe('default');
    expect(perfil.ice_breakers[0].call_to_actions.length).toBeLessThanOrEqual(
      4,
    );
    expect(perfil.ice_breakers[0].call_to_actions.length).toBe(
      ICE_BREAKERS_INSTAGRAM.length,
    );
  });

  it('armarPerfilCanal delega según el canal solicitado', () => {
    expect(armarPerfilCanal('messenger')).toEqual(armarPerfilMessenger());
    expect(armarPerfilCanal('instagram')).toEqual(armarPerfilInstagram());
  });

  describe('enviarPerfilMeta', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('envía la configuración a messenger_profile exitosamente', async () => {
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"result":"success"}'),
      });
      global.fetch = mockFetch;

      await expect(
        enviarPerfilMeta('v21.0', 'token-test', 'messenger'),
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://graph.facebook.com/v21.0/me/messenger_profile');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer token-test',
      );
    });

    it('lanza ServiceUnavailableException si Meta responde con código de error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":"Invalid param"}'),
      });

      await expect(
        enviarPerfilMeta('v21.0', 'token-test', 'instagram'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
