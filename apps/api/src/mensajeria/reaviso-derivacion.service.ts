import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { errorDeBase } from '../common/error-de-base';
import { estadoAtencion } from '../common/horario';
import { SupabaseService } from '../supabase/supabase.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import {
  MOTIVO_REAVISO,
  ventanaReaviso,
  type CandidataReaviso,
} from './reaviso-derivacion';

/** Vuelve a avisar al equipo de una derivación que nadie contestó (ver reaviso-derivacion.ts). */
@Injectable()
export class ReavisoDerivacionService {
  private readonly logger = new Logger(ReavisoDerivacionService.name);
  private ejecutando = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly avisoEquipo: AvisoEquipoService,
  ) {}

  @Cron('*/5 * * * *', { name: 'reaviso-derivacion' })
  async ejecutar(ahora: Date = new Date()): Promise<void> {
    if (this.ejecutando || estadoAtencion(ahora) === 'cerrado') return;
    this.ejecutando = true;
    try {
      for (const c of await this.candidatas(ahora)) {
        await this.revisar(c).catch((err: unknown) =>
          this.logger.error(
            `No se pudo re-avisar la derivación ${c.id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    } finally {
      this.ejecutando = false;
    }
  }

  private async revisar(c: CandidataReaviso): Promise<void> {
    // Se marca primero: una sola vez por derivación, aunque falle el aviso.
    await this.marcar(c.id);
    if (await this.equipoRespondio(c.id, c.derivado_en)) return;
    this.avisoEquipo.notificar({
      canal: c.canal,
      identificadorExterno: c.identificador_externo,
      telefono: c.telefono,
      conversacionId: c.id,
      motivo: MOTIVO_REAVISO,
    });
    this.logger.warn(
      `Derivación sin respuesta, se re-avisó al equipo — canal=${c.canal} id=${c.identificador_externo}`,
    );
  }

  private async candidatas(ahora: Date): Promise<CandidataReaviso[]> {
    const { desde, hasta } = ventanaReaviso(ahora);
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('id, canal, identificador_externo, telefono, derivado_en')
      .eq('estado', 'derivado')
      .is('reaviso_derivacion_en', null)
      .gte('derivado_en', desde)
      .lte('derivado_en', hasta)
      .returns<CandidataReaviso[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  private async equipoRespondio(
    conversacionId: string,
    desde: string,
  ): Promise<boolean> {
    const { count, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId)
      .eq('direccion', 'saliente_humano')
      .gte('created_at', desde);
    if (error) throw errorDeBase(error);
    return (count ?? 0) > 0;
  }

  private async marcar(conversacionId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({ reaviso_derivacion_en: new Date().toISOString() })
      .eq('id', conversacionId);
    if (error) throw errorDeBase(error);
  }
}
