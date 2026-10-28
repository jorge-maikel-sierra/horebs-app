import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProblemDetailsFilter, ProblemDetails } from './problem-details.filter';

function ejecutar(error: unknown) {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ originalUrl: '/admin/pedidos/abc' }),
    }),
  } as unknown as ArgumentsHost;
  new ProblemDetailsFilter().catch(error, host);
  const [[cuerpo]] = res.send.mock.calls as [[ProblemDetails]];
  return { res, cuerpo };
}

describe('ProblemDetailsFilter', () => {
  it('una HttpException sale como application/problem+json', () => {
    const { res, cuerpo } = ejecutar(
      new NotFoundException('Pedido no existe.'),
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    expect(cuerpo).toMatchObject({
      type: 'https://pizzeriahorebs.shop/problemas/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Pedido no existe.',
      instance: '/admin/pedidos/abc',
      message: 'Pedido no existe.',
    });
  });

  it('un mensaje en arreglo se une en un solo detail', () => {
    const { cuerpo } = ejecutar(
      new BadRequestException(['Falta A.', 'Falta B.']),
    );
    expect(cuerpo.detail).toBe('Falta A. Falta B.');
  });

  it('conserva errores[] de validación', () => {
    const errores = [{ campo: 'telefono', mensaje: 'Inválido.' }];
    const { cuerpo } = ejecutar(
      new BadRequestException({ message: 'Datos inválidos.', errores }),
    );
    expect(cuerpo.errores).toEqual(errores);
  });

  it('un error desconocido sale como 500 sin filtrar el stack', () => {
    const { res, cuerpo } = ejecutar(new Error('select * from secretos'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(cuerpo.detail).not.toContain('secretos');
  });

  it('el 503 lleva Retry-After', () => {
    const { res } = ejecutar(new ServiceUnavailableException('Caído.'));
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
  });
});
