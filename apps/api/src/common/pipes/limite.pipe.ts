import { BadRequestException, PipeTransform } from '@nestjs/common';

/** `?limit=` entero entre 1 y `max`; sin el parámetro devuelve undefined. */
export class LimitePipe implements PipeTransform<
  string | undefined,
  number | undefined
> {
  constructor(private readonly max: number) {}

  transform(valor: string | undefined): number | undefined {
    if (valor === undefined || valor === '') return undefined;
    const numero = /^\d+$/.test(valor) ? Number(valor) : NaN;
    if (!(numero >= 1 && numero <= this.max)) {
      throw new BadRequestException(
        `El parámetro "limit" debe ser un entero entre 1 y ${this.max}.`,
      );
    }
    return numero;
  }
}
