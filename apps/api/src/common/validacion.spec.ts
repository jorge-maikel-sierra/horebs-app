import {
  booleano,
  enumerado,
  esFechaValida,
  fecha,
  numero,
  opcional,
  texto,
  uuid,
  validarObjeto,
} from './validacion';

describe('esFechaValida', () => {
  it.each(['2026-10-27', '2024-02-29'])('acepta %s', (f) => {
    expect(esFechaValida(f)).toBe(true);
  });
  it.each(['2026-02-31', '2025-02-29', '2026-13-01', '27/10/2026', '2026-1-1'])(
    'rechaza %s',
    (f) => {
      expect(esFechaValida(f)).toBe(false);
    },
  );
});

describe('reglas', () => {
  it('texto: tipo, vacío y largo', () => {
    const regla = texto({ max: 5 });
    expect(regla('hola')).toBeNull();
    expect(regla(3)).toBe('debe ser texto');
    expect(regla('   ')).toBe('no puede estar vacío');
    expect(regla('demasiado')).toBe('no puede pasar de 5 caracteres');
  });
  it('numero: rechaza NaN, Infinity, strings y fuera de rango', () => {
    const regla = numero({ min: 0, entero: true });
    expect(regla(3)).toBeNull();
    expect(regla(NaN)).toBe('debe ser un número');
    expect(regla(Infinity)).toBe('debe ser un número');
    expect(regla('3')).toBe('debe ser un número');
    expect(regla(1.5)).toBe('debe ser un número entero');
    expect(regla(-1)).toBe('debe ser mayor o igual a 0');
  });
  it('booleano, uuid, fecha y enumerado', () => {
    expect(booleano()(true)).toBeNull();
    expect(booleano()('true')).not.toBeNull();
    expect(uuid()('0b0e6a4e-5d0e-4f6a-8f0e-3b7d1b1f2c3d')).toBeNull();
    expect(uuid()('abc')).not.toBeNull();
    expect(fecha()('2026-10-27')).toBeNull();
    expect(fecha()('mañana')).not.toBeNull();
    expect(enumerado(['a', 'b'])('c')).toBe('debe ser uno de: a, b');
  });
  it('opcional deja pasar undefined y null pero valida lo demás', () => {
    const regla = opcional(texto());
    expect(regla(undefined)).toBeNull();
    expect(regla(null)).toBeNull();
    expect(regla(5)).toBe('debe ser texto');
  });
});

describe('validarObjeto', () => {
  const esquema = { nombre: texto(), edad: opcional(numero({ min: 0 })) };

  it('sin errores devuelve []', () => {
    expect(validarObjeto(esquema, { nombre: 'Ana' })).toEqual([]);
  });
  it('junta todos los errores, no solo el primero', () => {
    const errores = validarObjeto(esquema, { nombre: '', edad: 'x' });
    expect(errores.map((e) => e.campo)).toEqual(['nombre', 'edad']);
  });
  it('estricto rechaza campos desconocidos; no estricto los deja', () => {
    expect(validarObjeto(esquema, { nombre: 'Ana', rol: 'admin' })).toEqual([
      { campo: 'rol', mensaje: 'El campo "rol" no es válido aquí.' },
    ]);
    expect(validarObjeto(esquema, { nombre: 'Ana', rol: 'x' }, false)).toEqual(
      [],
    );
  });
  it.each([null, [], 'texto', 5])('un body %p no es objeto', (valor) => {
    expect(validarObjeto(esquema, valor)).toEqual([
      { mensaje: 'El cuerpo debe ser un objeto JSON.' },
    ]);
  });
});
