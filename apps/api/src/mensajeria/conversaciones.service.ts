import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type CanalMensajeria = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';
export type EtapaSeguimiento = 'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';

export interface ConversacionParaSeguimiento {
  canal: CanalMensajeria;
  identificador_externo: string;
}

export interface ConversacionCompleta {
  id: string;
  canal: CanalMensajeria;
  identificador_externo: string;
  estado: EstadoConversacion;
  seguimiento_etapa: EtapaSeguimiento;
  seguimiento_enviado_en: string | null;
  ultima_interaccion: string;
}

export interface ConfiguracionSeguimiento {
  recordatorioMinutos: number;
  ofertaMinutos: number;
}

const CLAVE_RECORDATORIO_MINUTOS = 'seguimiento_recordatorio_minutos';
const CLAVE_OFERTA_MINUTOS = 'seguimiento_oferta_minutos';
// Mismos valores que trae la migración — solo entran en juego si por algún
// motivo las filas de configuracion no existen.
const DEFECTO_RECORDATORIO_MINUTOS = 180;
const DEFECTO_OFERTA_MINUTOS = 360;

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
   * cliente hace más de `minutosInactividad` — candidatas al próximo
   * mensaje de seguimiento. */
  async buscarInactivasSinSeguimiento(
    minutosInactividad: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = new Date(Date.now() - minutosInactividad * 60 * 1000).toISOString();
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
   * `minutosDesdeRecordatorio` y siguen sin responder — candidatas a la
   * oferta final. */
  async buscarConRecordatorioVencido(
    minutosDesdeRecordatorio: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = new Date(Date.now() - minutosDesdeRecordatorio * 60 * 1000).toISOString();
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

  /** Cuántos minutos hay que esperar en cada etapa del seguimiento —
   * editable por el admin desde /admin/seguimiento (tabla configuracion). */
  async obtenerConfiguracionSeguimiento(): Promise<ConfiguracionSeguimiento> {
    const { data, error } = await this.supabase
      .getClient()
      .from('configuracion')
      .select('clave, valor')
      .in('clave', [CLAVE_RECORDATORIO_MINUTOS, CLAVE_OFERTA_MINUTOS]);
    if (error) throw error;

    const mapa = new Map((data ?? []).map((f) => [f.clave, f.valor]));
    const recordatorio = Number(mapa.get(CLAVE_RECORDATORIO_MINUTOS));
    const oferta = Number(mapa.get(CLAVE_OFERTA_MINUTOS));
    return {
      recordatorioMinutos: Number.isFinite(recordatorio) && recordatorio > 0
        ? recordatorio
        : DEFECTO_RECORDATORIO_MINUTOS,
      ofertaMinutos: Number.isFinite(oferta) && oferta > 0 ? oferta : DEFECTO_OFERTA_MINUTOS,
    };
  }

  async actualizarConfiguracionSeguimiento(
    recordatorioMinutos: number,
    ofertaMinutos: number,
  ): Promise<void> {
    const { error } = await this.supabase.getClient().from('configuracion').upsert(
      [
        { clave: CLAVE_RECORDATORIO_MINUTOS, valor: String(recordatorioMinutos) },
        { clave: CLAVE_OFERTA_MINUTOS, valor: String(ofertaMinutos) },
      ],
      { onConflict: 'clave' },
    );
    if (error) throw error;
  }

  /** Listado completo para el panel de admin — todas las conversaciones
   * con su estado y etapa de seguimiento actual. */
  async listar(): Promise<ConversacionCompleta[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(
        'id, canal, identificador_externo, estado, seguimiento_etapa, seguimiento_enviado_en, ultima_interaccion',
      )
      .order('ultima_interaccion', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** El admin cambia el estado a mano desde el panel — en cualquier
   * dirección se resetea la memoria de Gemini y el seguimiento pendiente,
   * mismo criterio que cuando el bot deriva solo: el hilo arranca de cero. */
  async actualizarEstadoManual(id: string, estado: EstadoConversacion): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({
        estado,
        gemini_interaction_id: null,
        seguimiento_etapa: 'ninguna',
        seguimiento_enviado_en: null,
      })
      .eq('id', id);
    if (error) throw error;
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
