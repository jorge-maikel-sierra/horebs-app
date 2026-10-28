/* eslint-disable @typescript-eslint/unbound-method -- el handler se pasa solo para leer su metadata */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import {
  CacheControlInterceptor,
  CachePublica,
} from './cache-control.interceptor';
import { Deprecada, DeprecacionInterceptor } from './deprecacion.interceptor';
import { Ubicacion, UbicacionInterceptor } from './ubicacion.interceptor';

class Rutas {
  @Ubicacion('/pedidos/:id')
  crea() {}

  @Ubicacion('/turnos/actual')
  creaUnico() {}

  @Deprecada('/turnos/:id/nuevo')
  vieja() {}

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

describe('Ubicacion con plantilla estática', () => {
  it('manda Location aunque el cuerpo no traiga id', async () => {
    const { ctx, res } = contexto(rutas.creaUnico);
    await lastValueFrom(
      new UbicacionInterceptor(new Reflector()).intercept(ctx, siguiente({})),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Location', '/turnos/actual');
  });
});

describe('DeprecacionInterceptor', () => {
  const interceptor = new DeprecacionInterceptor(new Reflector());

  function contextoConParams(
    metodo: () => void,
    params: Record<string, string>,
  ) {
    const res = { setHeader: jest.fn() };
    const ctx = {
      getHandler: () => metodo,
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ params }),
      }),
    } as unknown as ExecutionContext;
    return { ctx, res };
  }

  it('marca la ruta vieja con Deprecation y Link a la sucesora', async () => {
    const { ctx, res } = contextoConParams(rutas.vieja, { id: 'abc' });
    await lastValueFrom(interceptor.intercept(ctx, siguiente({})));
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', '@1793145600');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</turnos/abc/nuevo>; rel="successor-version"',
    );
  });

  it('una ruta sin marcar no se toca', async () => {
    const { ctx, res } = contextoConParams(rutas.privada, {});
    await lastValueFrom(interceptor.intercept(ctx, siguiente({})));
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
