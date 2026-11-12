import { ServiceUnavailableException } from '@nestjs/common';

const HTTP_DEMASIADAS_PETICIONES = 429;
const HTTP_ERROR_CLIENTE_MIN = 400;
const HTTP_ERROR_SERVIDOR_MIN = 500;

/**
 * Error de Graph que no se arregla reintentando (ventana de 24 h cerrada,
 * token inválido, destinatario que no existe): reintentarlo solo demora la
 * respuesta y llena los logs. Extiende ServiceUnavailableException para que
 * quien ya lo atrapa como tal no cambie.
 */
export class ErrorGraphPermanente extends ServiceUnavailableException {}

/** 4xx es permanente salvo el 429 (límite de envíos), que sí vale reintentar. */
export function esErrorPermanente(status: number): boolean {
  return (
    status >= HTTP_ERROR_CLIENTE_MIN &&
    status < HTTP_ERROR_SERVIDOR_MIN &&
    status !== HTTP_DEMASIADAS_PETICIONES
  );
}

export function errorDeGraph(
  status: number,
  mensaje: string,
): ServiceUnavailableException {
  return esErrorPermanente(status)
    ? new ErrorGraphPermanente(mensaje)
    : new ServiceUnavailableException(mensaje);
}
