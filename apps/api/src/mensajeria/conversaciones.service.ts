import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type CanalMensajeria = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';

/**
 * Estado por conversación (canal + número/PSID/IGSID) contra la tabla
 * conversaciones_bot — le da memoria al bot entre mensajes: si ya se pidió
 * un humano, el bot deja de auto-responder ese hilo.
 */
@Injectable()
export class ConversacionesService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtenerEstado(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<EstadoConversacion> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('estado')
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle();
    if (error) throw error;
    return (data?.estado as EstadoConversacion) ?? 'bot';
  }

  async registrarInteraccion(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .upsert(
        {
          canal,
          identificador_externo: identificadorExterno,
          ultima_interaccion: new Date().toISOString(),
        },
        { onConflict: 'canal,identificador_externo' },
      );
    if (error) throw error;
  }

  async derivarAHumano(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .upsert(
        {
          canal,
          identificador_externo: identificadorExterno,
          estado: 'derivado',
          ultima_interaccion: new Date().toISOString(),
        },
        { onConflict: 'canal,identificador_externo' },
      );
    if (error) throw error;
  }
}
