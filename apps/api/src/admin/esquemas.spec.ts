import { validarObjeto } from '../common/validacion';
import {
  ESQUEMA_CONFIGURACION_CORREOS,
  ESQUEMA_PERFIL_MENSAJERIA,
  ESQUEMA_VENTA,
} from './esquemas';

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

describe('ESQUEMA_VENTA', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_VENTA, cuerpo).map((e) => e.campo);
  const VENTA = {
    cliente: { nombre: 'Ana' },
    modalidad: 'domicilio',
    metodo_pago: 'efectivo',
    items: [],
  };

  it('acepta el body del punto de venta, con opcionales', () => {
    expect(campos(VENTA)).toEqual([]);
    expect(
      campos({
        ...VENTA,
        direccion_entrega: 'Carrera 7',
        costo_domicilio: 5000,
        notas: 'sin cebolla',
        usar_puntos: true,
      }),
    ).toEqual([]);
  });

  it('exige cliente, modalidad, método de pago e items', () => {
    expect(campos({})).toEqual([
      'cliente',
      'modalidad',
      'metodo_pago',
      'items',
    ]);
  });

  it('una modalidad inventada, un costo negativo o items que no son lista es error', () => {
    expect(
      campos({
        ...VENTA,
        modalidad: 'volando',
        costo_domicilio: -1,
        items: 'x',
      }),
    ).toEqual(['modalidad', 'costo_domicilio', 'items']);
  });

  it('un campo desconocido es error', () => {
    expect(campos({ ...VENTA, descuento: 50 })).toEqual(['descuento']);
  });
});

describe('ESQUEMA_PERFIL_MENSAJERIA', () => {
  it('acepta un objeto vacío', () => {
    expect(validarObjeto(ESQUEMA_PERFIL_MENSAJERIA, {})).toEqual([]);
  });

  it('rechaza propiedades inesperadas', () => {
    expect(
      validarObjeto(ESQUEMA_PERFIL_MENSAJERIA, { extra: true }).map(
        (e) => e.campo,
      ),
    ).toEqual(['extra']);
  });
});
