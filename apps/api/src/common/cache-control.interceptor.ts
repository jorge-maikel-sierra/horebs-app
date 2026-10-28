import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable } from 'rxjs';

const CACHE_PUBLICA_KEY = 'cache-publica-segundos';

/**
 * Marca un GET público e idéntico para todos (catálogo, artículos): se puede
 * guardar en caché compartida durante `segundos`. Todo lo demás sale con
 * `no-store` (RFC 9111): respuestas del panel o de una sesión nunca deben
 * quedar en una caché intermedia.
 */
export const CachePublica = (segundos: number) =>
  SetMetadata(CACHE_PUBLICA_KEY, segundos);

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    contexto: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const segundos = this.reflector.get<number | undefined>(
      CACHE_PUBLICA_KEY,
      contexto.getHandler(),
    );
    contexto
      .switchToHttp()
      .getResponse<Response>()
      .setHeader(
        'Cache-Control',
        segundos === undefined ? 'no-store' : `public, max-age=${segundos}`,
      );
    return next.handle();
  }
}
