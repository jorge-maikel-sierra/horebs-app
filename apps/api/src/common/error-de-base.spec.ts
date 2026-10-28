import {
  BadRequestException,
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
});
