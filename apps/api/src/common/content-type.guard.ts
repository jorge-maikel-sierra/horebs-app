import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';

const METODOS_CON_BODY = new Set(['POST', 'PUT', 'PATCH']);
const RUTAS_EXENTAS = ['/webhooks/'];

/**
 * 415 (RFC 9110 §15.5.16) cuando un POST/PUT/PATCH trae body que no es JSON.
 * Una request sin body (ej. `POST /x/activar`) pasa. Los webhooks de Meta
 * quedan fuera: su contrato y la firma sobre el body crudo no se tocan.
 */
@Injectable()
export class ContentTypeGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<Request>();
    if (!METODOS_CON_BODY.has(req.method)) return true;
    if (RUTAS_EXENTAS.some((ruta) => req.path.startsWith(ruta))) return true;
    // req.is: null si no hay body, false si el tipo no coincide.
    if (req.is('json') === false) {
      throw new UnsupportedMediaTypeException(
        'El contenido debe enviarse como application/json.',
      );
    }
    return true;
  }
}
