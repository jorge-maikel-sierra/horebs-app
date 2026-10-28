import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const logger = new Logger('Base de datos');

/**
 * Error de Supabase → excepción de Nest (AGENTS.md: nunca relanzar el error
 * crudo). El detalle técnico va al log; al cliente le llega un mensaje
 * genérico, sin códigos ni nombres de tablas. Una HttpException que ya
 * venía armada (ej. un BadRequestException relanzado) pasa intacta.
 *
 * Uso: `if (error) throw errorDeBase(error);`
 */
export function errorDeBase(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const detalle =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);
  logger.error(detalle);
  return new ServiceUnavailableException(
    'No se pudo acceder a los datos. Intentá de nuevo en un momento.',
  );
}
