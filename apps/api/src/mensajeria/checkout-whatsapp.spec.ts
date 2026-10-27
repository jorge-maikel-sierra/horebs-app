import {
  BOTON,
  direccionDeUbicacion,
  direccionEscritaValida,
  esCancelar,
  esSaludoOIntencionDePedir,
  metodoPagoDe,
  modalidadDe,
  separarNombre,
  siguientePaso,
} from './checkout-whatsapp';

const texto = (t: string) => ({ tipo: 'texto' as const, texto: t });

describe('modalidadDe', () => {
  it('toma el botón', () => {
    expect(modalidadDe({ tipo: 'boton', id: BOTON.domicilio })).toBe(
      'domicilio',
    );
    expect(modalidadDe({ tipo: 'boton', id: BOTON.local })).toBe('local');
  });

  it.each([
    ['A domicilio por favor', 'domicilio'],
    ['me la envían', 'domicilio'],
    ['paso a recogerla', 'retiro'],
    ['la retiro yo', 'retiro'],
    ['para comer en el local', 'local'],
  ])('entiende "%s"', (t, esperado) => {
    expect(modalidadDe(texto(t))).toBe(esperado);
  });

  it('una pregunta no es una modalidad', () => {
    expect(modalidadDe(texto('¿cuánto se demora?'))).toBeNull();
  });
});

describe('metodoPagoDe', () => {
  it.each([
    ['efectivo', 'efectivo'],
    ['Transferencia', 'transferencia'],
    ['por Nequi', 'transferencia'],
    ['con tarjeta', 'tarjeta'],
  ])('entiende "%s"', (t, esperado) => {
    expect(metodoPagoDe(texto(t))).toBe(esperado);
  });

  it('toma el botón', () => {
    expect(metodoPagoDe({ tipo: 'boton', id: BOTON.transferencia })).toBe(
      'transferencia',
    );
  });
});

describe('separarNombre', () => {
  it('nombre y apellido, con mayúscula inicial', () => {
    expect(separarNombre('me llamo jorge sierra')).toEqual({
      nombre: 'Jorge',
      apellido: 'Sierra',
    });
  });

  it('apellidos compuestos quedan juntos', () => {
    expect(separarNombre('María José Pérez Gómez').apellido).toBe(
      'José Pérez Gómez',
    );
  });

  it('una sola palabra deja el apellido para preguntarlo', () => {
    expect(separarNombre('Jorge')).toEqual({ nombre: 'Jorge', apellido: null });
  });
});

describe('siguientePaso', () => {
  it('pide en orden lo que falta', () => {
    expect(siguientePaso({ paso: 'modalidad' })).toBe('modalidad');
    expect(siguientePaso({ paso: 'modalidad', modalidad: 'domicilio' })).toBe(
      'direccion',
    );
    expect(siguientePaso({ paso: 'modalidad', modalidad: 'retiro' })).toBe(
      'nombre',
    );
    expect(
      siguientePaso({
        paso: 'nombre',
        modalidad: 'domicilio',
        direccion: 'Calle 1',
        nombre: 'Jorge',
        apellido: 'Sierra',
      }),
    ).toBe('pago');
  });
});

describe('ubicación y dirección', () => {
  it('arma un link de Google Maps con lo que venga', () => {
    expect(
      direccionDeUbicacion({
        tipo: 'ubicacion',
        latitud: 11.54,
        longitud: -72.9,
        direccion: 'Cra 7 # 33-66',
      }),
    ).toBe('Cra 7 # 33-66 — https://maps.google.com/?q=11.54,-72.9');
    expect(
      direccionDeUbicacion({ tipo: 'ubicacion', latitud: 1, longitud: 2 }),
    ).toBe('📍 https://maps.google.com/?q=1,2');
  });

  it('una dirección escrita necesita al menos 5 caracteres', () => {
    expect(direccionEscritaValida('si')).toBe(false);
    expect(direccionEscritaValida('Carrera 7H1 # 33 - 66')).toBe(true);
  });
});

describe('cancelar y saludo', () => {
  it('reconoce cancelar', () => {
    expect(esCancelar('Cancelar')).toBe(true);
    expect(esCancelar('no quiero cancelar nada')).toBe(false);
  });

  it('saludo corto sí, pregunta concreta no', () => {
    expect(esSaludoOIntencionDePedir('Hola')).toBe(true);
    expect(esSaludoOIntencionDePedir('Buenas noches')).toBe(true);
    expect(esSaludoOIntencionDePedir('quiero pedir')).toBe(true);
    expect(esSaludoOIntencionDePedir('¿a qué hora abren?')).toBe(false);
  });
});
