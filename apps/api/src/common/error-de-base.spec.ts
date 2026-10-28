import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { errorDeBase } from './error-de-base';

describe('errorDeBase', () => {
  it('un error de Supabase sale como 503 sin filtrar el detalle', () => {
    const ex = errorDeBase({
      message: 'relation "pedidos" does not exist',
      code: '42P01',
    });
    expect(ex).toBeInstanceOf(ServiceUnavailableException);
    expect(ex.message).not.toContain('pedidos');
  });

  it('una excepción de Nest pasa intacta', () => {
    const original = new BadRequestException('Falta el nombre.');
    expect(errorDeBase(original)).toBe(original);
  });

  it.each([
    ['23505', ConflictException],
    ['23503', ConflictException],
    ['22P02', BadRequestException],
    ['23502', BadRequestException],
    ['PGRST116', NotFoundException],
  ])('el código %s se traduce a su status HTTP', (code, clase) => {
    const ex = errorDeBase({
      message: 'duplicate key value violates "pedidos_pkey"',
      code,
    });
    expect(ex).toBeInstanceOf(clase);
    expect(ex.message).not.toContain('pedidos');
  });
});
