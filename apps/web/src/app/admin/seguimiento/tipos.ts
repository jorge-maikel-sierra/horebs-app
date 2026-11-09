export type Canal = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';
export type EtapaSeguimiento =
  | 'ninguna'
  | 'recordatorio_enviado'
  | 'oferta_enviada';
export type DireccionMensaje = 'entrante' | 'saliente_bot' | 'saliente_humano';

export type Conversacion = {
  id: string;
  canal: Canal;
  identificador_externo: string;
  telefono?: string | null;
  estado: EstadoConversacion;
  seguimiento_etapa: EtapaSeguimiento;
  seguimiento_enviado_en: string | null;
  ultima_interaccion: string;
};

export type Mensaje = {
  id: string;
  conversacion_id: string;
  direccion: DireccionMensaje;
  texto: string;
  autor_usuario_id: string | null;
  created_at: string;
};

export type FiltroVista = 'por_atender' | 'todas' | 'bot';

export const ETIQUETA_CANAL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export const ETIQUETA_ETAPA: Record<EtapaSeguimiento, string> = {
  ninguna: 'Sin seguimiento',
  recordatorio_enviado: 'Recordatorio enviado',
  oferta_enviada: 'Oferta enviada',
};

/** Cuántos pasos del seguimiento (recordatorio, oferta) ya se mandaron. */
export const PASOS_ETAPA: Record<EtapaSeguimiento, number> = {
  ninguna: 0,
  recordatorio_enviado: 1,
  oferta_enviada: 2,
};

// Bien por debajo del rate limit de 120 req/min de la API; cada callback
// además chequea document.hidden y no dispara el fetch con la pestaña en
// background.
export const INTERVALO_LISTA_MS = 15_000;
export const INTERVALO_HILO_MS = 5_000;

/** Pasada la ventana de 24 h de Meta ya no se puede escribirle al cliente. */
export const VENTANA_META_MINUTOS = 24 * 60;
