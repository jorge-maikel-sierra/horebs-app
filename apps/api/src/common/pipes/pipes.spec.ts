import { BadRequestException } from '@nestjs/common';
import { texto } from '../validacion';
import { FechaPipe } from './fecha.pipe';
import { LimitePipe } from './limite.pipe';
import { ValidarBodyPipe } from './validar-body.pipe';

describe('LimitePipe', () => {
  const pipe = new LimitePipe(100);
  it('sin valor devuelve undefined', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('')).toBeUndefined();
  });
  it('acepta enteros dentro del rango', () => {
    expect(pipe.transform('25')).toBe(25);
  });
  it.each(['0', '-3', 'abc', '1.5', '101', 'NaN'])('rechaza %s', (v) => {
    expect(() => pipe.transform(v)).toThrow(BadRequestException);
  });
});

describe('FechaPipe', () => {
  const pipe = new FechaPipe('desde');
  it('acepta una fecha real y deja pasar la ausencia', () => {
    expect(pipe.transform('2026-10-27')).toBe('2026-10-27');
    expect(pipe.transform(undefined)).toBeUndefined();
  });
  it('rechaza fechas inexistentes con el nombre del parámetro', () => {
    expect(() => pipe.transform('2026-02-31')).toThrow(/"desde"/);
  });
});

describe('ValidarBodyPipe', () => {
  const pipe = new ValidarBodyPipe({ nombre: texto() });
  it('devuelve el body si es válido', () => {
    const body = { nombre: 'Ana' };
    expect(pipe.transform(body)).toBe(body);
  });
  it('lanza 400 con errores[] y un mensaje legible', () => {
    try {
      pipe.transform({ nombre: '', extra: 1 });
      fail('debía lanzar');
    } catch (e) {
      const cuerpo = (e as BadRequestException).getResponse() as {
        message: string;
        errores: unknown[];
      };
      expect(cuerpo.errores).toHaveLength(2);
      expect(cuerpo.message).toContain('"nombre"');
    }
  });
});
