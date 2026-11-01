import {
  cantidadDe,
  itemsEscritosDe,
  textoDe,
  validarDatosCliente,
} from './datos-pedido-bot';

const COMPLETOS = {
  nombre: 'Ana',
  apellido: 'Pérez',
  modalidad: 'domicilio',
  direccion: ' Carrera 7 # 17B - 66 ',
};

describe('textoDe', () => {
  it('deja pasar texto y números; lo demás cuenta como vacío', () => {
    expect(textoDe('hola')).toBe('hola');
    expect(textoDe(3)).toBe('3');
    expect(textoDe(undefined)).toBe('');
    expect(textoDe(null)).toBe('');
    expect(textoDe({ a: 1 })).toBe('');
  });
});

describe('itemsEscritosDe', () => {
  it('lee la lista o devuelve vacío si no es una lista', () => {
    expect(itemsEscritosDe({ items: [{ producto: 'x' }] })).toEqual([
      { producto: 'x' },
    ]);
    expect(itemsEscritosDe({ items: 'x' })).toEqual([]);
    expect(itemsEscritosDe({})).toEqual([]);
  });
});

describe('cantidadDe', () => {
  it.each([
    [undefined, 1],
    [0, 1],
    ['abc', 1],
    [-4, 1],
    [3, 3],
    [2.6, 3],
    [500, 20],
  ])('cantidad %j → %i', (cantidad, esperada) => {
    expect(cantidadDe({ cantidad })).toBe(esperada);
  });
});

describe('validarDatosCliente', () => {
  it('acepta un pedido a domicilio completo y recorta la dirección', () => {
    expect(validarDatosCliente(COMPLETOS)).toEqual({
      ok: true,
      datos: {
        modalidad: 'domicilio',
        direccion: 'Carrera 7 # 17B - 66',
        nombre: 'Ana',
        apellido: 'Pérez',
      },
    });
  });

  it('retirar no pide dirección y la modalidad no distingue mayúsculas', () => {
    const resultado = validarDatosCliente({
      ...COMPLETOS,
      modalidad: 'Retiro',
      direccion: undefined,
    });
    expect(resultado).toMatchObject({
      ok: true,
      datos: { modalidad: 'retiro', direccion: undefined },
    });
  });

  it.each([{ nombre: ' ' }, { apellido: '' }])(
    'sin nombre completo (%j) no calcula',
    (cambio) => {
      const resultado = validarDatosCliente({ ...COMPLETOS, ...cambio });
      expect(resultado).toMatchObject({ ok: false });
      expect(!resultado.ok && resultado.texto).toContain('nombre completo');
    },
  );

  it('una modalidad que no existe no calcula', () => {
    const resultado = validarDatosCliente({ ...COMPLETOS, modalidad: 'dron' });
    expect(!resultado.ok && resultado.texto).toContain('Falta la modalidad');
  });

  it('un domicilio sin dirección no calcula', () => {
    const resultado = validarDatosCliente({ ...COMPLETOS, direccion: '  ' });
    expect(!resultado.ok && resultado.texto).toContain('dirección de entrega');
  });
});
