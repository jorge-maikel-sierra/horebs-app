import { BadRequestException, PipeTransform } from '@nestjs/common';
import { Esquema, validarObjeto } from '../validacion';

/**
 * Valida el body contra un esquema (ver `common/validacion.ts`) y responde
 * 400 con `errores[]` (RFC 9457) si algo no cuadra.
 * Uso: `@Body(new ValidarBodyPipe(ESQUEMA)) body: Tipo`.
 */
export class ValidarBodyPipe implements PipeTransform {
  constructor(
    private readonly esquema: Esquema,
    private readonly estricto = true,
  ) {}

  transform(valor: unknown): unknown {
    const errores = validarObjeto(this.esquema, valor, this.estricto);
    if (errores.length > 0) {
      throw new BadRequestException({
        message: errores.map((e) => e.mensaje).join(' '),
        errores,
      });
    }
    return valor;
  }
}
