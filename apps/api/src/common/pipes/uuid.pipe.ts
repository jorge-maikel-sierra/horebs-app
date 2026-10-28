import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** `@Param('id', UuidPipe)`: un id que no es uuid es 400, no un error de base. */
export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('El identificador no es válido.'),
});

/** Igual que `UuidPipe`, para un query param que puede faltar. */
export const UuidOpcionalPipe = new ParseUUIDPipe({
  optional: true,
  exceptionFactory: () =>
    new BadRequestException('El identificador no es válido.'),
});
