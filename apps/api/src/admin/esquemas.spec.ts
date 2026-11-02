import { validarObjeto } from '../common/validacion';
import { ESQUEMA_CONFIGURACION_CORREOS } from './esquemas';

describe('ESQUEMA_CONFIGURACION_CORREOS', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_CONFIGURACION_CORREOS, cuerpo).map((e) => e.campo);

  it('acepta un correo, los dos o ninguno (el panel manda uno por vez)', () => {
    expect(campos({ correo_domiciliario: 'moto@correo.co' })).toEqual([]);
    expect(
      campos({
        correo_domiciliario: 'moto@correo.co',
        correo_avisos_bot: 'bot@correo.co',
      }),
    ).toEqual([]);
    expect(campos({})).toEqual([]);
  });

  it('un correo que no es texto o es demasiado largo es error', () => {
    expect(campos({ correo_domiciliario: 42 })).toEqual([
      'correo_domiciliario',
    ]);
    expect(campos({ correo_avisos_bot: 'a'.repeat(255) })).toEqual([
      'correo_avisos_bot',
    ]);
  });

  it('un campo desconocido es error', () => {
    expect(campos({ correo_cliente: 'x@correo.co' })).toEqual([
      'correo_cliente',
    ]);
  });
});
