import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

const logger = new Logger('Base de datos');

/** Código de Postgres/PostgREST → excepción HTTP con un mensaje sin detalles técnicos. */
const EXCEPCION_POR_CODIGO = new Map<string, () => HttpException>(
  Object.entries({
    // unique_violation, foreign_key_violation
    '23505': () =>
      new ConflictException('Ya existe un registro con esos datos.'),
    '23503': () =>
      new ConflictException('El registro está relacionado con otros datos.'),
    // invalid_text_representation, not_null_violation
    '22P02': () => new BadRequestException('Alguno de los datos no es válido.'),
    '23502': () => new BadRequestException('Faltan datos obligatorios.'),
    // PostgREST: .single() sin filas
    PGRST116: () => new NotFoundException('No se encontró el registro.'),
  }),
);

function codigoDe(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Error de Supabase → excepción de Nest (AGENTS.md: nunca relanzar el error
 * crudo). El detalle técnico va al log; al cliente le llega un mensaje
 * genérico, sin códigos ni nombres de tablas. Los códigos de Postgres que
 * tienen un equivalente HTTP claro (duplicado, referencia, dato inválido,
 * sin filas) salen con ese status (RFC 9110); el resto es 503. Una
 * HttpException que ya venía armada pasa intacta.
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

  const codigo = codigoDe(error);
  const excepcion = codigo ? EXCEPCION_POR_CODIGO.get(codigo) : undefined;
  if (excepcion) return excepcion();

  return new ServiceUnavailableException(
    'No se pudo acceder a los datos. Intentá de nuevo en un momento.',
  );
}
