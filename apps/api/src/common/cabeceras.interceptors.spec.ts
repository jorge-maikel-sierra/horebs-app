import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import {
  CacheControlInterceptor,
  CachePublica,
} from './cache-control.interceptor';
import { Ubicacion, UbicacionInterceptor } from './ubicacion.interceptor';

class Rutas {
  @Ubicacion('/pedidos/:id')
  crea() {}

  @CachePublica(60)
  publica() {}

  privada() {}
}

function contexto(metodo: () => void) {
  const res = { setHeader: jest.fn() };
  const ctx = {
    getHandler: () => metodo,
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { ctx, res };
}

const siguiente = (cuerpo: unknown): CallHandler => ({
  handle: () => of(cuerpo),
});
const rutas = new Rutas();

describe('UbicacionInterceptor', () => {
  const interceptor = new UbicacionInterceptor(new Reflector());

  it('arma Location con el id del cuerpo', async () => {
    const { ctx, res } = contexto(rutas.crea);
    await lastValueFrom(interceptor.intercept(ctx, siguiente({ id: 'abc-1' })));
    expect(res.setHeader).toHaveBeenCalledWith('Location', '/pedidos/abc-1');
  });

  it('sin id en el cuerpo, o sin decorador, no manda Location', async () => {
    const a = contexto(rutas.crea);
    await lastValueFrom(interceptor.intercept(a.ctx, siguiente({ ok: true })));
    const b = contexto(rutas.privada);
    await lastValueFrom(interceptor.intercept(b.ctx, siguiente({ id: 'x' })));
    expect(a.res.setHeader).not.toHaveBeenCalled();
    expect(b.res.setHeader).not.toHaveBeenCalled();
  });
});

describe('CacheControlInterceptor', () => {
  const interceptor = new CacheControlInterceptor(new Reflector());

  it('una ruta marcada como pública usa max-age', async () => {
    const { ctx, res } = contexto(rutas.publica);
    await lastValueFrom(interceptor.intercept(ctx, siguiente({})));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60',
    );
  });

  it('cualquier otra sale con no-store', async () => {
    const { ctx, res } = contexto(rutas.privada);
    await lastValueFrom(interceptor.intercept(ctx, siguiente({})));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
