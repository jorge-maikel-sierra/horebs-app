import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import type {
  CanalMensajeria,
  CheckoutWhatsapp,
  ConfiguracionSeguimiento,
  ConversacionCompleta,
  ConversacionParaSeguimiento,
  DireccionMensaje,
  EstadoConversacion,
  EtapaSeguimiento,
  ItemCarritoPendiente,
  MensajeConversacion,
} from './conversaciones.tipos';

export type * from './conversaciones.tipos';
import {
  avanzarVentanaLimite,
  CLAVE_OFERTA_MINUTOS,
  CLAVE_RECORDATORIO_MINUTOS,
  configuracionDeFilas,
  haceMinutos,
  payloadDerivacion,
  payloadFrenoCosto,
} from './conversaciones-reglas';

const COLUMNAS_CONVERSACION =
  'id, canal, identificador_externo, telefono, estado, seguimiento_etapa, seguimiento_enviado_en, ultima_interaccion';

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
    const fila = await this.leerHilo<{ estado: EstadoConversacion }>(
      canal,
      identificadorExterno,
      'estado',
    );
    return fila?.estado ?? 'bot';
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
    const fila = await this.leerHilo<{ gemini_interaction_id: string | null }>(
      canal,
      identificadorExterno,
      'gemini_interaction_id',
    );
    return fila?.gemini_interaction_id ?? null;
  }

  async guardarInteraccionGemini(
    canal: CanalMensajeria,
    identificadorExterno: string,
    interactionId: string,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, {
      gemini_interaction_id: interactionId,
    });
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
      .select(COLUMNAS_CONVERSACION)
      .single();
    if (error) throw errorDeBase(error);
    return data;
  }

  /** Conversaciones sin resolver (nunca derivadas) sin actividad del
   * cliente hace más de `minutosInactividad` — candidatas al próximo
   * mensaje de seguimiento. */
  async buscarInactivasSinSeguimiento(
    minutosInactividad: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = haceMinutos(minutosInactividad);
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('id, canal, identificador_externo')
      .eq('estado', 'bot')
      .eq('seguimiento_etapa', 'ninguna')
      .lt('ultima_interaccion', limite);
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /** Conversaciones a las que ya se les mandó el recordatorio hace más de
   * `minutosDesdeRecordatorio` y siguen sin responder — candidatas a la
   * oferta final. */
  async buscarConRecordatorioVencido(
    minutosDesdeRecordatorio: number,
  ): Promise<ConversacionParaSeguimiento[]> {
    const limite = haceMinutos(minutosDesdeRecordatorio);
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select('id, canal, identificador_externo')
      .eq('estado', 'bot')
      .eq('seguimiento_etapa', 'recordatorio_enviado')
      .lt('seguimiento_enviado_en', limite);
    if (error) throw errorDeBase(error);
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
    if (error) throw errorDeBase(error);

    return configuracionDeFilas(data ?? []);
  }

  async actualizarConfiguracionSeguimiento(
    recordatorioMinutos: number,
    ofertaMinutos: number,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('configuracion')
      .upsert(
        [
          {
            clave: CLAVE_RECORDATORIO_MINUTOS,
            valor: String(recordatorioMinutos),
          },
          { clave: CLAVE_OFERTA_MINUTOS, valor: String(ofertaMinutos) },
        ],
        { onConflict: 'clave' },
      );
    if (error) throw errorDeBase(error);
  }

  /** Listado completo para el panel de admin — todas las conversaciones
   * con su estado y etapa de seguimiento actual. */
  async listar(): Promise<ConversacionCompleta[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(COLUMNAS_CONVERSACION)
      .order('ultima_interaccion', { ascending: false });
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /** Solo lo mínimo para que el endpoint de "enviar mensaje humano" resuelva
   * a quién mandarle sin que el frontend tenga que conocer
   * canal/identificador_externo. */
  async obtenerPorId(id: string): Promise<ConversacionCompleta | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(COLUMNAS_CONVERSACION)
      .eq('id', id)
      .maybeSingle();
    if (error) throw errorDeBase(error);
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
      .single<MensajeConversacion>();
    if (error) throw errorDeBase(error);
    return data;
  }

  /** Hilo completo de una conversación, en orden cronológico. */
  async listarMensajes(conversacionId: string): Promise<MensajeConversacion[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('mensajes_conversacion')
      .select()
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true })
      .returns<MensajeConversacion[]>();
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  /** El admin cambia el estado a mano desde el panel — en cualquier
   * dirección se resetea la memoria de Gemini y el seguimiento pendiente,
   * mismo criterio que cuando el bot deriva solo: el hilo arranca de cero. */
  async actualizarEstadoManual(
    id: string,
    estado: EstadoConversacion,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update({
        estado,
        gemini_interaction_id: null,
        seguimiento_etapa: 'ninguna',
        seguimiento_enviado_en: null,
        carrito_pendiente: null,
        checkout: null,
      })
      .eq('id', id);
    if (error) throw errorDeBase(error);
  }

  async guardarCheckout(
    canal: CanalMensajeria,
    identificadorExterno: string,
    checkout: CheckoutWhatsapp | null,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, { checkout });
  }

  async obtenerCheckout(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<CheckoutWhatsapp | null> {
    const fila = await this.leerHilo<{ checkout: CheckoutWhatsapp | null }>(
      canal,
      identificadorExterno,
      'checkout',
    );
    return fila?.checkout ?? null;
  }

  /**
   * Conversación con su último mensaje del cliente — define la ventana
   * gratis de 24h de WhatsApp para los avisos que manda el sistema.
   */
  async obtenerVentana(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<{
    conversacionId: string;
    estado: EstadoConversacion;
    ultimaInteraccion: Date;
  } | null> {
    const fila = await this.leerHilo<{
      id: string;
      estado: EstadoConversacion;
      ultima_interaccion: string | null;
    }>(canal, identificadorExterno, 'id, estado, ultima_interaccion');
    if (!fila?.ultima_interaccion) return null;
    return {
      conversacionId: fila.id,
      estado: fila.estado,
      ultimaInteraccion: new Date(fila.ultima_interaccion),
    };
  }

  /**
   * Carrito del catálogo de WhatsApp (ids exactos de variante) que el
   * cliente mandó y todavía no se derivó. calcular_pedido lo usa tal cual,
   * sin que el modelo tenga que volver a nombrar los productos. Un carrito
   * nuevo pisa el anterior: WhatsApp manda siempre el carrito completo.
   */
  async guardarCarrito(
    canal: CanalMensajeria,
    identificadorExterno: string,
    items: ItemCarritoPendiente[] | null,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, {
      carrito_pendiente: items,
    });
  }

  async obtenerCarrito(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<ItemCarritoPendiente[]> {
    const fila = await this.leerHilo<{
      carrito_pendiente: ItemCarritoPendiente[] | null;
    }>(canal, identificadorExterno, 'carrito_pendiente');
    return fila?.carrito_pendiente ?? [];
  }

  async marcarSeguimientoEnviado(
    canal: CanalMensajeria,
    identificadorExterno: string,
    etapa: EtapaSeguimiento,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, {
      seguimiento_etapa: etapa,
      seguimiento_enviado_en: new Date().toISOString(),
    });
  }

  async guardarTelefono(
    canal: CanalMensajeria,
    identificadorExterno: string,
    telefono: string,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, { telefono });
  }

  async derivarAHumano(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .upsert(payloadDerivacion(canal, identificadorExterno), {
        onConflict: 'canal,identificador_externo',
      });
    if (error) throw errorDeBase(error);
  }

  /**
   * Meta manda el `ctwa_clid` solo en el primer mensaje de una conversación
   * que empezó con un clic en anuncio. Un clic nuevo trae un id nuevo, así
   * que siempre se pisa el anterior — la atribución es al último anuncio.
   */
  async guardarCtwaClid(
    canal: CanalMensajeria,
    identificadorExterno: string,
    ctwaClid: string,
  ): Promise<void> {
    await this.actualizarHilo(canal, identificadorExterno, {
      ctwa_clid: ctwaClid,
      ctwa_capturado_en: new Date().toISOString(),
    });
  }

  /** La conversación con su `ctwa_clid`, o null si nunca vino de un anuncio
   * (o si no existe). Solo la usa la API de conversiones de Meta. */
  async obtenerCtwa(
    canal: CanalMensajeria,
    identificadorExterno: string,
  ): Promise<{ id: string; ctwaClid: string } | null> {
    const fila = await this.leerHilo<{ id: string; ctwa_clid: string | null }>(
      canal,
      identificadorExterno,
      'id, ctwa_clid',
    );
    if (!fila?.ctwa_clid) return null;
    return { id: fila.id, ctwaClid: fila.ctwa_clid };
  }

  /**
   * Meta puede reenviar el mismo webhook (mismo id de mensaje) sin avisar
   * — se registra el id apenas se ve por primera vez; si el insert choca
   * con la clave primaria (canal, mensaje_id) es que ya se procesó antes.
   * Cualquier otro error (ej. la tabla no responde) se relanza tal cual —
   * es responsabilidad del caller decidir si ante un fallo de esta
   * verificación prefiere igual procesar el mensaje o no.
   */
  async yaProcesado(
    canal: CanalMensajeria,
    mensajeId: string,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .getClient()
      .from('mensajes_procesados')
      .insert({ canal, mensaje_id: mensajeId });
    if (!error) return false;
    if (error.code === '23505') return true;
    throw errorDeBase(error);
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
      .maybeSingle<{
        limite_ventana_inicio: string | null;
        limite_ventana_contador: number | null;
      }>();
    if (error) throw errorDeBase(error);

    const ventana = avanzarVentanaLimite(
      {
        inicio: data?.limite_ventana_inicio ?? null,
        contador: data?.limite_ventana_contador ?? null,
      },
      new Date(),
      ventanaMinutos,
    );

    const { error: upsertError } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .upsert(payloadFrenoCosto(canal, identificadorExterno, ventana), {
        onConflict: 'canal,identificador_externo',
      });
    if (upsertError) throw errorDeBase(upsertError);

    return ventana.contador <= maxMensajes;
  }

  /** Una fila de `conversaciones_bot` por canal + identificador, solo con las columnas pedidas. */
  private async leerHilo<T>(
    canal: CanalMensajeria,
    identificadorExterno: string,
    columnas: string,
  ): Promise<T | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .select(columnas)
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno)
      .maybeSingle<T>();
    if (error) throw errorDeBase(error);
    return data;
  }

  private async actualizarHilo(
    canal: CanalMensajeria,
    identificadorExterno: string,
    cambios: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('conversaciones_bot')
      .update(cambios)
      .eq('canal', canal)
      .eq('identificador_externo', identificadorExterno);
    if (error) throw errorDeBase(error);
  }
}
