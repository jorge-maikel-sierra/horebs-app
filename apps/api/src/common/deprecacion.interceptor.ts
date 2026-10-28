import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

const DEPRECADA_KEY = 'deprecada-sucesora';

/**
 * Instante desde el que las rutas con verbos están deprecadas
 * (2026-10-28T00:00:00Z), en segundos Unix: es el formato del header
 * `Deprecation` según RFC 9745 (`@<segundos>`).
 */
const DEPRECADA_DESDE = 1793145600;

/**
 * Marca una ruta vieja y apunta a su sucesora. La ruta sigue funcionando; la
 * respuesta lleva `Deprecation` y `Link: <sucesora>; rel="successor-version"`
 * para que el cliente migre. `:param` de la sucesora se rellena con los
 * params de la request. Uso: `@Deprecada('/turnos/actual')`.
 */
export const Deprecada = (sucesora: string) =>
  SetMetadata(DEPRECADA_KEY, sucesora);

@Injectable()
export class DeprecacionInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    contexto: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const sucesora = this.reflector.get<string | undefined>(
      DEPRECADA_KEY,
      contexto.getHandler(),
    );
    if (!sucesora) return next.handle();

    const http = contexto.switchToHttp();
    const params = new Map(
      Object.entries(http.getRequest<Request>().params ?? {}),
    );
    const destino = sucesora.replace(/:(\w+)/g, (parametro, nombre: string) => {
      const valor = params.get(nombre);
      return typeof valor === 'string' ? valor : parametro;
    });
    const res = http.getResponse<Response>();
    res.setHeader('Deprecation', `@${DEPRECADA_DESDE}`);
    res.setHeader('Link', `<${destino}>; rel="successor-version"`);
    return next.handle();
  }
}
