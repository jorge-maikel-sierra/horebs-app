import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CLAVE_CORREO_AVISOS_BOT } from '../mail/mail.service';
import { errorDeBase } from '../common/error-de-base';

/** Correos de avisos editables desde /admin/configuracion. */
export interface ConfiguracionCorreos {
  /** Pedidos a domicilio y alertas de stock/puntos. */
  correo_domiciliario: string | null;
  /** Solo los avisos del bot cuando deriva una conversación. */
  correo_avisos_bot: string | null;
}

const CLAVES_CORREO = ['correo_domiciliario', CLAVE_CORREO_AVISOS_BOT];

/** Correos de aviso editables desde /admin/configuracion. */
@Injectable()
export class ConfiguracionAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerConfiguracion(): Promise<ConfiguracionCorreos> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('clave, valor')
      .in('clave', CLAVES_CORREO)
      .returns<{ clave: string; valor: string | null }[]>();

    if (error) throw errorDeBase(error);
    const valor = (clave: string): string | null =>
      (data ?? []).find((f) => f.clave === clave)?.valor || null;
    return {
      correo_domiciliario: valor('correo_domiciliario'),
      correo_avisos_bot: valor(CLAVE_CORREO_AVISOS_BOT),
    };
  }

  /**
   * Guarda solo las claves que vienen en el body — cada tarjeta del panel
   * guarda la suya. Upsert: `correo_avisos_bot` puede no tener fila todavía.
   */
  async actualizarConfiguracion(
    cambios: Partial<ConfiguracionCorreos>,
  ): Promise<ConfiguracionCorreos> {
    const filas = CLAVES_CORREO.flatMap((clave) => {
      const crudo = cambios[clave as keyof ConfiguracionCorreos];
      if (crudo === undefined) return [];
      const correo = String(crudo ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new BadRequestException('El correo no es válido.');
      }
      return [{ clave, valor: correo, updated_at: new Date().toISOString() }];
    });
    if (filas.length === 0) {
      throw new BadRequestException(
        'No se recibió ningún correo para guardar.',
      );
    }

    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .upsert(filas, { onConflict: 'clave' });

    if (error) throw errorDeBase(error);
    return this.obtenerConfiguracion();
  }
}
