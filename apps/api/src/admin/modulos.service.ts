import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';

/**
 * Módulos del panel que el dueño puede apagar. Panel, Usuarios y
 * Configuración no están: apagarlos dejaría al admin sin forma de volver a
 * encenderlos.
 */
export const MODULOS_ACTIVABLES = [
  'pos',
  'pedidos',
  'clientes',
  'inventario',
  'nomina',
  'seguimiento',
  'informes',
  'blog',
] as const;

export type ModuloId = (typeof MODULOS_ACTIVABLES)[number];

export interface ModuloEstadoDto {
  id: ModuloId;
  activo: boolean;
}

const PREFIJO = 'modulo_';

@Injectable()
export class ModulosService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Sin fila guardada, el módulo está activo: solo se persiste lo apagado o lo reencendido. */
  async listar(): Promise<ModuloEstadoDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('clave, valor')
      .like('clave', `${PREFIJO}%`);

    if (error) throw errorDeBase(error);

    const valores = new Map((data ?? []).map((f) => [f.clave, f.valor]));
    return MODULOS_ACTIVABLES.map((id) => ({
      id,
      activo: valores.get(`${PREFIJO}${id}`) !== 'false',
    }));
  }

  async cambiar(id: string, activo: unknown): Promise<ModuloEstadoDto> {
    if (!MODULOS_ACTIVABLES.includes(id as ModuloId)) {
      throw new BadRequestException(
        'Ese módulo no se puede activar ni desactivar.',
      );
    }
    if (typeof activo !== 'boolean') {
      throw new BadRequestException('"activo" debe ser verdadero o falso.');
    }

    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .upsert(
        {
          clave: `${PREFIJO}${id}`,
          valor: String(activo),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clave' },
      );

    if (error) throw errorDeBase(error);
    return { id: id as ModuloId, activo };
  }
}
