import { validarObjeto } from '../common/validacion';
import { ESQUEMA_CREAR_POST, ESQUEMA_EDITAR_POST } from './esquemas';

const POST = {
  titulo: 'Pizza de la casa',
  slug: 'pizza-de-la-casa',
  resumen: 'La firma de Horebs',
  contenido: '# Texto',
};

describe('ESQUEMA_CREAR_POST', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_CREAR_POST, cuerpo).map((e) => e.campo);

  it('acepta el body del editor, con opcionales vacíos', () => {
    expect(
      campos({
        ...POST,
        palabra_clave: '',
        imagen_url: '',
        etiqueta: '',
        estado: 'publicado',
      }),
    ).toEqual([]);
  });

  it('exige título, slug, resumen y contenido', () => {
    expect(campos({})).toEqual(['titulo', 'slug', 'resumen', 'contenido']);
  });

  it('un estado inventado o un campo desconocido es error', () => {
    expect(campos({ ...POST, estado: 'archivado', autor: 'x' })).toEqual([
      'estado',
      'autor',
    ]);
  });
});

describe('ESQUEMA_EDITAR_POST', () => {
  const campos = (cuerpo: object) =>
    validarObjeto(ESQUEMA_EDITAR_POST, cuerpo).map((e) => e.campo);

  it('acepta un cuerpo vacío y un cambio parcial', () => {
    expect(campos({})).toEqual([]);
    expect(campos({ estado: 'borrador' })).toEqual([]);
  });

  it('un campo desconocido es error', () => {
    expect(campos({ autor: 'x' })).toEqual(['autor']);
  });

  it('lo obligatorio no se puede vaciar', () => {
    expect(campos({ titulo: '  ', contenido: '' })).toEqual([
      'titulo',
      'contenido',
    ]);
  });
});
