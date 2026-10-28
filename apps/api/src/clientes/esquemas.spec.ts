import { validarObjeto } from '../common/validacion';
import { ESQUEMA_EDITAR_CLIENTE } from './esquemas';

const campos = (cuerpo: object) =>
  validarObjeto(ESQUEMA_EDITAR_CLIENTE, cuerpo).map((e) => e.campo);

describe('ESQUEMA_EDITAR_CLIENTE', () => {
  it('acepta el body del panel, con cadena vacía para borrar un dato', () => {
    expect(
      campos({
        nombre: 'Ana',
        apellido: '',
        telefono: '3157861208',
        direccion: '',
        correo: '',
        cedula: '',
      }),
    ).toEqual([]);
  });

  it('el nombre no se puede vaciar', () => {
    expect(campos({ nombre: '' })).toEqual(['nombre']);
  });

  it('un campo desconocido es error', () => {
    expect(campos({ puntos: 100 })).toEqual(['puntos']);
  });
});
