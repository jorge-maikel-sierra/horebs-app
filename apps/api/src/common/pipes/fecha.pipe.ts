import { BadRequestException, PipeTransform } from '@nestjs/common';
import { esFechaValida } from '../validacion';

/** Fecha `AAAA-MM-DD` real; si es opcional y falta, devuelve undefined. */
export class FechaPipe implements PipeTransform<
  string | undefined,
  string | undefined
> {
  constructor(private readonly nombre: string) {}

  transform(valor: string | undefined): string | undefined {
    if (valor === undefined || valor === '') return undefined;
    if (!esFechaValida(valor)) {
      throw new BadRequestException(
        `El parámetro "${this.nombre}" debe ser una fecha con formato AAAA-MM-DD.`,
      );
    }
    return valor;
  }
}
