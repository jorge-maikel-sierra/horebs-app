import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type CanalMensajeria = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';
export type EtapaSeguimiento = 'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';

export interface ConversacionParaSeguimiento {
  canal: CanalMensajeria;
  identificador_externo: string;
}

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

  /**
   * El ID de la última interacción con Gemini para este hilo — le da
   * memoria al modelo entre mensajes separados (Interactions API lo
   * mantiene server-side si se lo pasás en `previous_interaction_id`).
   */
  async obtenerUltimaInteraccionGemini(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('gemini_interaction_id')
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle();
    if (error) throw error;
    return data?.gemini_interaction_id ?? null;
  }

  async guardarInteraccionGemini(
    canal: CanalMensajeria,
    identificadorExterno: string,
    interactionId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({ gemini_interaction_id: interactionId })
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno);
    if (error) throw error;
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
          // Un mensaje nuevo del cliente cancela cualquier seguimiento
          // pendiente — ya no está "abandonado".
          seguimiento_etapa: 'ninguna',
          seguimiento_enviado_en: null,
        },
        { onConflict: 'canal,identificador_externo' },
      );
    if (error) throw error;
  }

  /** Conversaciones sin resolver (nunca derivadas) sin actividad del
   * cliente hace más de `horasInactividad` — candidatas al próximo
   * mensaje de seguimiento. */
  async buscarInactivasSinSeguimiento(
    horasInactividad: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = new Date(Date.now() - horasInactividad * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('canal, identificador_externo')
      .eq('estado', 'bot')
      .eq('seguimiento_etapa', 'ninguna')
      .lt('ultima_interaccion', limite);
    if (error) throw error;
    return data ?? [];
  }

  /** Conversaciones a las que ya se les mandó el recordatorio hace más de
   * `horasDesdeRecordatorio` y siguen sin responder — candidatas a la
   * oferta final. */
  async buscarConRecordatorioVencido(
    horasDesdeRecordatorio: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = new Date(Date.now() - horasDesdeRecordatorio * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('canal, identificador_externo')
      .eq('estado', 'bot')
      .eq('seguimiento_etapa', 'recordatorio_enviado')
      .lt('seguimiento_enviado_en', limite);
    if (error) throw error;
    return data ?? [];
  }

  async marcarSeguimientoEnviado(
    canal: CanalMensajeria,
    identificadorExterno: string,
    etapa: EtapaSeguimiento,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({ seguimiento_etapa: etapa, seguimiento_enviado_en: new Date().toISOString() })
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno);
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
          // Al derivar, la persona humana toma la conversación desde acá —
          // cuando el bot vuelva a responder más adelante, arranca de cero.
          gemini_interaction_id: null,
          seguimiento_etapa: 'ninguna',
          seguimiento_enviado_en: null,
        },
        { onConflict: 'canal,identificador_externo' },
      );
    if (error) throw error;
  }
}
