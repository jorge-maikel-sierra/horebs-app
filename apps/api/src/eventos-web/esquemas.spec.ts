import { validarObjeto } from '../common/validacion';
import { ESQUEMA_EVENTO_WEB } from './esquemas';

const EVENTO = {
  event_name: 'AddToCart',
  event_id: '6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b',
  url: 'https://pizzeriahorebs.shop/producto/pizza-horebs-especial',
};

const campos = (cuerpo: object): (string | undefined)[] =>
  validarObjeto(ESQUEMA_EVENTO_WEB, cuerpo).map((e) => e.campo);

describe('ESQUEMA_EVENTO_WEB', () => {
  it('acepta un evento con sus opcionales', () => {
    expect(
      campos({
        ...EVENTO,
        fbp: 'fb.1.1596403881668.1116446470',
        value: 32000,
        content_ids: [],
      }),
    ).toEqual([]);
  });

  it('rechaza un evento que no se reenvía y un id que no es uuid', () => {
    expect(
      campos({ ...EVENTO, event_name: 'Purchase', event_id: 'abc' }),
    ).toEqual(['event_name', 'event_id']);
  });

  it('rechaza un campo desconocido', () => {
    expect(campos({ ...EVENTO, email: 'x@y.co' })).toEqual(['email']);
  });
});
