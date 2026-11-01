import type { ExecutionContext } from '@nestjs/common';

/** Lo mínimo del request que leen los guards y decorators de auth. */
export interface RequestConUsuario<U> {
  headers: { authorization?: string };
  usuario?: U;
}

const PREFIJO_BEARER = 'Bearer ';

/** El token del header `Authorization: Bearer <token>`, o undefined si falta. */
export function tokenBearer(
  authHeader: string | undefined,
): string | undefined {
  return authHeader?.startsWith(PREFIJO_BEARER)
    ? authHeader.slice(PREFIJO_BEARER.length)
    : undefined;
}

/** El usuario que dejó el guard en el request (para los param decorators). */
export function usuarioDelRequest<U>(ctx: ExecutionContext): U {
  const request = ctx.switchToHttp().getRequest<RequestConUsuario<U>>();
  return request.usuario as U;
}
