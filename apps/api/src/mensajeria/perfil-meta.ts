export type CanalMeta = 'messenger' | 'instagram';

export interface ResultadoPerfilCanalDto {
  ok: true;
  canal: CanalMeta;
}

export interface ItemMenuPersistente {
  type: 'postback';
  title: string;
  payload: string;
}

export interface IceBreaker {
  question: string;
  payload: string;
}

const MAX_ITEMS_MENU_PERSISTENTE = 5;
const MAX_LARGO_TITULO_MENU = 30;
const MAX_ICE_BREAKERS = 4;

export const ITEMS_MENU_MESSENGER: ItemMenuPersistente[] = [
  { type: 'postback', title: 'Ver menú 🍕', payload: 'menu' },
  { type: 'postback', title: 'Hacer un pedido 🛵', payload: 'pedir' },
  { type: 'postback', title: 'Horario y ubicación 📍', payload: 'horario' },
  {
    type: 'postback',
    title: 'Consultar mi pedido 📦',
    payload: 'consultar_pedido',
  },
  {
    type: 'postback',
    title: 'Hablar con una persona 👤',
    payload: 'humano',
  },
];

export const ICE_BREAKERS_INSTAGRAM: IceBreaker[] = [
  { question: 'Ver el menú 🍕', payload: 'menu' },
  { question: 'Hacer un pedido 🛵', payload: 'pedir' },
  { question: 'Horario y ubicación 📍', payload: 'horario' },
  { question: 'Consultar mi pedido 📦', payload: 'consultar_pedido' },
];

export function armarPerfilMessenger(): Record<string, unknown> {
  const items = ITEMS_MENU_MESSENGER.slice(0, MAX_ITEMS_MENU_PERSISTENTE).map(
    (item) => ({
      ...item,
      title: item.title.slice(0, MAX_LARGO_TITULO_MENU),
    }),
  );
  return {
    get_started: { payload: 'iniciar' },
    persistent_menu: [
      {
        locale: 'default',
        composer_input_disabled: false,
        call_to_actions: items,
      },
    ],
  };
}

export function armarPerfilInstagram(): Record<string, unknown> {
  const items = ICE_BREAKERS_INSTAGRAM.slice(0, MAX_ICE_BREAKERS);
  return {
    ice_breakers: [
      {
        locale: 'default',
        call_to_actions: items,
      },
    ],
  };
}

export function armarPerfilCanal(
  canal: 'messenger' | 'instagram',
): Record<string, unknown> {
  return canal === 'messenger'
    ? armarPerfilMessenger()
    : armarPerfilInstagram();
}
