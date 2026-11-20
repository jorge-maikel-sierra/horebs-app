import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ESTADOS_RESENA, type EstadoResena } from './resenas.tipos';

/** `?estado=` opcional: si viene, tiene que ser un estado de reseña conocido. */
@Injectable()
export class EstadoResenaPipe implements PipeTransform {
  transform(valor: unknown): EstadoResena | undefined {
    if (valor === undefined || valor === '') return undefined;
    if (ESTADOS_RESENA.includes(valor as EstadoResena)) {
      return valor as EstadoResena;
    }
    throw new BadRequestException(
      `estado debe ser uno de: ${ESTADOS_RESENA.join(', ')}`,
    );
  }
}
