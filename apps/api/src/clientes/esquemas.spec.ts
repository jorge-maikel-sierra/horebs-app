import { validarObjeto } from '../common/validacion';
import {
  ESQUEMA_CONFIGURACION_PUNTOS,
  ESQUEMA_EDITAR_CLIENTE,
} from './esquemas';

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

describe('ESQUEMA_CONFIGURACION_PUNTOS', () => {
  const camposPuntos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_CONFIGURACION_PUNTOS, cuerpo).map((e) => e.campo);

  it('acepta la configuración completa que manda el panel', () => {
    expect(
      camposPuntos({
        puntosPor1000Pesos: 1,
        valorPuntoPesos: 50,
        puntosMinimoCanje: 100,
        puntosVencimientoMeses: 12,
      }),
    ).toEqual([]);
  });

  it('acepta un cambio parcial y un cuerpo vacío', () => {
    expect(camposPuntos({ valorPuntoPesos: 60 })).toEqual([]);
    expect(camposPuntos({})).toEqual([]);
  });

  it('un valor negativo o que no es número es error', () => {
    expect(
      camposPuntos({ valorPuntoPesos: -1, puntosMinimoCanje: '100' }),
    ).toEqual(['valorPuntoPesos', 'puntosMinimoCanje']);
  });

  it('un campo desconocido es error', () => {
    expect(camposPuntos({ descuento: 10 })).toEqual(['descuento']);
  });
});
