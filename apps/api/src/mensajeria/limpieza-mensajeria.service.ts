import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { MS_POR_DIA } from '../common/tiempo';
import { SupabaseService } from '../supabase/supabase.service';

/** Meta reenvía un webhook a lo sumo durante horas; un mes de margen sobra. */
const DIAS_RETENCION_IDS = 30;

export function limiteRetencion(ahora: Date): string {
  return new Date(
    ahora.getTime() - DIAS_RETENCION_IDS * MS_POR_DIA,
  ).toISOString();
}

/**
 * `mensajes_procesados` solo sirve para descartar reenvíos de Meta, pero
 * crecía para siempre (una fila por mensaje). Se borra lo de más de 30 días
 * una vez por día, de madrugada en Bogotá (4:00 a.m. = 9:00 UTC).
 */
@Injectable()
export class LimpiezaMensajeriaService {
  private readonly logger = new Logger(LimpiezaMensajeriaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron('0 9 * * *', { name: 'limpieza-mensajes-procesados' })
  async limpiar(): Promise<void> {
    try {
      const { error, count } = await this.supabase
        .getClient()
        .from('mensajes_procesados')
        .delete({ count: 'exact' })
        .lt('procesado_en', limiteRetencion(new Date()));
      if (error) throw errorDeBase(error);
      this.logger.log(`Ids de mensajes viejos borrados: ${count ?? 0}`);
    } catch (err) {
      this.logger.error(
        `No se pudo limpiar mensajes_procesados: ${(err as Error).message}`,
      );
    }
  }
}
