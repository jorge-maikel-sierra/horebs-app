import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

const UBICACION_KEY = 'ubicacion';

/**
 * Marca un POST que crea un recurso con su URL (RFC 9110 §15.3.2: el 201
 * identifica lo creado con `Location`). `:id` se reemplaza por el `id` del
 * cuerpo de la respuesta. Solo se usa donde ese GET existe: un `Location`
 * que apunta a una ruta inexistente es peor que no mandarlo.
 *
 * Uso: `@Ubicacion('/pedidos/:id')`.
 */
export const Ubicacion = (plantilla: string) =>
  SetMetadata(UBICACION_KEY, plantilla);

@Injectable()
export class UbicacionInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    contexto: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const plantilla = this.reflector.get<string | undefined>(
      UBICACION_KEY,
      contexto.getHandler(),
    );
    if (!plantilla) return next.handle();

    const res = contexto.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap((cuerpo) => {
        const id = (cuerpo as { id?: unknown } | null)?.id;
        if (typeof id === 'string') {
          res.setHeader(
            'Location',
            plantilla.replace(':id', encodeURIComponent(id)),
          );
        }
      }),
    );
  }
}
