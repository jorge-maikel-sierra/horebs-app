import {
  armarPerfilCanal,
  armarPerfilInstagram,
  armarPerfilMessenger,
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
});
