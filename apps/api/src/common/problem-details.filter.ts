import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const TIPO_BASE = 'https://pizzeriahorebs.shop/problemas';
const DETALLE_INTERNO = 'Ocurrió un error inesperado. Intentá de nuevo.';
const REINTENTO_503_SEGUNDOS = 30;

/** Error de validación de un campo concreto (RFC 9457 §3.2, miembro de extensión). */
export interface ErrorDeCampo {
  campo?: string;
  mensaje: string;
}

/** Cuerpo de error según RFC 9457, servido como `application/problem+json`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errores?: ErrorDeCampo[];
}

interface CuerpoDeNest {
  message?: string | string[];
  errores?: ErrorDeCampo[];
}

/** Nombre del enum de Nest por status (HttpStatus tiene mapeo inverso). */
const NOMBRE_POR_STATUS = new Map<number, string>(
  Object.entries(HttpStatus)
    .filter((par): par is [string, number] => typeof par[1] === 'number')
    .map(([nombre, status]) => [status, nombre]),
);

function slugDeStatus(status: number): string {
  const nombre = NOMBRE_POR_STATUS.get(status);
  return nombre ? nombre.toLowerCase().replaceAll('_', '-') : 'error';
}

function tituloDeStatus(status: number): string {
  const nombre = NOMBRE_POR_STATUS.get(status);
  if (!nombre) return 'Error';
  return nombre
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function cuerpoDe(excepcion: HttpException): CuerpoDeNest {
  const respuesta = excepcion.getResponse();
  return typeof respuesta === 'object' ? respuesta : {};
}

function detalleDe(excepcion: HttpException, cuerpo: CuerpoDeNest): string {
  const { message } = cuerpo;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return excepcion.message;
}

/**
 * Filtro global: toda respuesta de error sale como Problem Details
 * (RFC 9457). Un error que no es HttpException se responde 500 con un
 * detalle genérico — el stack va al log, nunca al cliente.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    const problema = this.armarProblema(error, req.originalUrl);
    // Un error nunca va a una caché; los interceptores no lo cubren porque un
    // 401 o un 404 sin ruta salen antes de llegar a ellos.
    res.setHeader('Cache-Control', 'no-store');
    if (problema.status === Number(HttpStatus.SERVICE_UNAVAILABLE)) {
      res.setHeader('Retry-After', String(REINTENTO_503_SEGUNDOS));
    }
    res.status(problema.status).type('application/problem+json').send(problema);
  }

  private armarProblema(error: unknown, instance: string): ProblemDetails {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const cuerpo = cuerpoDe(error);
      const detail = detalleDe(error, cuerpo);
      return {
        type: `${TIPO_BASE}/${slugDeStatus(status)}`,
        title: tituloDeStatus(status),
        status,
        detail,
        instance,
        ...(cuerpo.errores ? { errores: cuerpo.errores } : {}),
      };
    }

    this.logger.error(
      `${instance} — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      type: `${TIPO_BASE}/${slugDeStatus(status)}`,
      title: tituloDeStatus(status),
      status,
      detail: DETALLE_INTERNO,
      instance,
    };
  }
}
