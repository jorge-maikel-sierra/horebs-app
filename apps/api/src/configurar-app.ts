import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheControlInterceptor } from './common/cache-control.interceptor';
import { ContentTypeGuard } from './common/content-type.guard';
import { DeprecacionInterceptor } from './common/deprecacion.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { UbicacionInterceptor } from './common/ubicacion.interceptor';

/** Cabeceras que el navegador solo deja leer a un fetch de otro origen si se exponen. */
const CABECERAS_EXPUESTAS = ['Location', 'Deprecation', 'Link', 'Retry-After'];

/**
 * CORS: FRONTEND_URL admite una lista separada por comas (dominio propio,
 * subdominio www, la URL de Vercel, etc.). Fuera de producción el front puede
 * levantar en cualquier puerto (si el 3001 está ocupado, Next salta al
 * siguiente), así que se acepta cualquier localhost además de FRONTEND_URL.
 */
function origenesPermitidos(): (string | RegExp)[] {
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim());
  return process.env.NODE_ENV === 'production'
    ? frontendUrls
    : [...frontendUrls, /^http:\/\/localhost:\d+$/];
}

/**
 * Todo lo que define el contrato HTTP del API, en un solo lugar: lo usan
 * `main.ts` y el e2e del contrato, así no pueden divergir.
 */
export function configurarApp(app: INestApplication): void {
  app.enableCors({
    origin: origenesPermitidos(),
    credentials: true,
    exposedHeaders: CABECERAS_EXPUESTAS,
  });

  // Todo error sale como Problem Details (RFC 9457).
  app.useGlobalFilters(new ProblemDetailsFilter());
  // 415 si un POST/PUT/PATCH trae un body que no es JSON (RFC 9110).
  app.useGlobalGuards(new ContentTypeGuard());
  // Location en los 201 que apuntan a un recurso, y Cache-Control en todo.
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new CacheControlInterceptor(reflector),
    new UbicacionInterceptor(reflector),
    new DeprecacionInterceptor(reflector),
  );
}
