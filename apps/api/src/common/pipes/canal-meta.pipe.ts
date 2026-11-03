import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { CanalMeta } from '../../mensajeria/perfil-meta';

export type { CanalMeta };

export class CanalMetaPipe implements PipeTransform<string, CanalMeta> {
  transform(valor: string): CanalMeta {
    if (valor === 'messenger' || valor === 'instagram') {
      return valor;
    }
    throw new BadRequestException('El canal debe ser messenger o instagram.');
  }
}
