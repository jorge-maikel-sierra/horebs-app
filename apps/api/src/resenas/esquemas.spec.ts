import { validarObjeto } from '../common/validacion';
import { ESQUEMA_ACTUALIZAR_RESENA } from './esquemas';

describe('ESQUEMA_ACTUALIZAR_RESENA', () => {
  it('acepta publicar con respuesta y descartar sin ella', () => {
    expect(
      validarObjeto(ESQUEMA_ACTUALIZAR_RESENA, {
        estado: 'respondida',
        respuesta: 'Gracias',
      }),
    ).toEqual([]);
    expect(
      validarObjeto(ESQUEMA_ACTUALIZAR_RESENA, { estado: 'descartada' }),
    ).toEqual([]);
  });

  it('rechaza un estado que no se puede poner a mano', () => {
    expect(
      validarObjeto(ESQUEMA_ACTUALIZAR_RESENA, { estado: 'pendiente' }),
    ).toHaveLength(1);
  });

  it('rechaza un campo desconocido', () => {
    expect(
      validarObjeto(ESQUEMA_ACTUALIZAR_RESENA, {
        estado: 'descartada',
        estrellas: 5,
      }),
    ).toHaveLength(1);
  });
});
