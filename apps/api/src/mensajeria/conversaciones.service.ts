import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type CanalMensajeria = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';
export type EtapaSeguimiento = 'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';

export interface ConversacionParaSeguimiento {
  id: string;
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

export type DireccionMensaje = 'entrante' | 'saliente_bot' | 'saliente_humano';

export interface MensajeConversacion {
  id: string;
  conversacion_id: string;
  direccion: DireccionMensaje;
  texto: string;
  autor_usuario_id: string | null;
  created_at: string;
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

  /**
   * Devuelve la fila completa (`.select().single()`) para que el caller
   * tenga el `id` de la conversación sin una query extra — lo necesita
   * `webhooks.service.ts` para persistir el mensaje entrante y decidir el
   * corte por `estado==='derivado'` sin volver a consultar.
   */
  async registrarInteraccion(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<ConversacionCompleta> {
    const { data, error } = await this.supabase
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
      )
      .select(
        'id, canal, identificador_externo, estado, seguimiento_etapa, seguimiento_enviado_en, ultima_interaccion',
      )
      .single();
    if (error) throw error;
    return data;
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
      .select('id, canal, identificador_externo')
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
      .select('id, canal, identificador_externo')
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

  /** Solo lo mínimo para que el endpoint de "enviar mensaje humano" resuelva
   * a quién mandarle sin que el frontend tenga que conocer
   * canal/identificador_externo. */
  async obtenerPorId(id: string): Promise<ConversacionCompleta | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(
        'id, canal, identificador_externo, estado, seguimiento_etapa, seguimiento_enviado_en, ultima_interaccion',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Persiste el texto de un mensaje (entrante del cliente, o saliente del
   * bot/de un humano) — antes de esto no quedaba ningún registro del
   * contenido de la conversación, solo metadatos de estado. */
  async registrarMensaje(
    conversacionId: string,
    direccion: DireccionMensaje,
    texto: string,
    autorUsuarioId?: string,
  ): Promise<MensajeConversacion> {
    const { data, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .insert({
        conversacion_id: conversacionId,
        direccion,
        texto,
        autor_usuario_id: autorUsuarioId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Igual que `registrarMensaje`, pero con `created_at` explícito — solo
   * para la importación de historial viejo desde Gemini (ver
   * `importar-historial-gemini.service.ts`), donde el momento real del
   * mensaje no es "ahora" sino una fecha pasada aproximada. */
  async registrarMensajeConTimestamp(
    conversacionId: string,
    direccion: DireccionMensaje,
    texto: string,
    createdAt: Date,
  ): Promise<MensajeConversacion> {
    const { data, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .insert({
        conversacion_id: conversacionId,
        direccion,
        texto,
        created_at: createdAt.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Hilo completo de una conversación, en orden cronológico. */
  async listarMensajes(conversacionId: string): Promise<MensajeConversacion[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .select()
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true });
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

  /**
   * Meta puede reenviar el mismo webhook (mismo id de mensaje) sin avisar
   * — se registra el id apenas se ve por primera vez; si el insert choca
   * con la clave primaria (canal, mensaje_id) es que ya se procesó antes.
   * Cualquier otro error (ej. la tabla no responde) se relanza tal cual —
   * es responsabilidad del caller decidir si ante un fallo de esta
   * verificación prefiere igual procesar el mensaje o no.
   */
  async yaProcesado(canal: CanalMensajeria, mensajeId: string): Promise<boolean> {
    const { error } = await this.supabase
      .getClient()
      .from('mensajes_procesados')
      .insert({ canal, mensaje_id: mensajeId });
    if (!error) return false;
    if (error.code === '23505') return true;
    throw error;
  }

  /**
   * Freno de costo: sin esto, un número real mandando mensajes seguidos (o
   * un loop/bug del lado de Meta) dispara una llamada paga a Gemini por
   * cada uno, sin techo. Ventana simple en la misma fila de la conversación
   * — no hace falta exactitud perfecta bajo carrera, es un freno de costo,
   * no un límite de seguridad.
   */
  async dentroDelLimiteDeMensajes(
    canal: CanalMensajeria,
    identificadorExterno: string,
    ventanaMinutos: number,
    maxMensajes: number,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('limite_ventana_inicio, limite_ventana_contador')
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle();
    if (error) throw error;

    const ahora = new Date();
    const inicioPrevio = data?.limite_ventana_inicio ? new Date(data.limite_ventana_inicio) : null;
    const siguePreDentroDeVentana =
      inicioPrevio !== null && ahora.getTime() - inicioPrevio.getTime() < ventanaMinutos * 60 * 1000;
    const nuevoContador = (siguePreDentroDeVentana ? data?.limite_ventana_contador ?? 0 : 0) + 1;

    const { error: upsertError } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .upsert(
        {
          canal,
          identificador_externo: identificadorExterno,
          limite_ventana_inicio: siguePreDentroDeVentana ? inicioPrevio!.toISOString() : ahora.toISOString(),
          limite_ventana_contador: nuevoContador,
        },
        { onConflict: 'canal,identificador_externo' },
      );
    if (upsertError) throw upsertError;

    return nuevoContador <= maxMensajes;
  }
}
