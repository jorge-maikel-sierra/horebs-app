export type CanalMensajeria = 'whatsapp' | 'messenger' | 'instagram';
export type EstadoConversacion = 'bot' | 'derivado';
export type EtapaSeguimiento =
  'ninguna' | 'recordatorio_enviado' | 'oferta_enviada';

export interface ConversacionParaSeguimiento {
  id: string;
  canal: CanalMensajeria;
  identificador_externo: string;
  telefono?: string | null;
  ultima_interaccion?: string;
}

export interface ConversacionCompleta {
  id: string;
  canal: CanalMensajeria;
  identificador_externo: string;
  telefono?: string | null;
  estado: EstadoConversacion;
  seguimiento_etapa: EtapaSeguimiento;
  seguimiento_enviado_en: string | null;
  ultima_interaccion: string;
}

export type DireccionMensaje = 'entrante' | 'saliente_bot' | 'saliente_humano';

/** Fila de `conversaciones_bot.carrito_pendiente` (jsonb). */
export interface ItemCarritoPendiente {
  varianteId: string;
  cantidad: number;
}

export type ModalidadPedido = 'domicilio' | 'retiro' | 'local';
export type PasoCheckout =
  | 'adicionales'
  | 'modalidad'
  | 'direccion'
  | 'nombre'
  | 'telefono'
  | 'hora'
  | 'pago';

/** `conversaciones_bot.checkout` (jsonb) — en qué paso del checkout con botones va el cliente. */
export interface CheckoutWhatsapp {
  paso: PasoCheckout;
  modalidad?: ModalidadPedido;
  direccion?: string;
  /** Dirección de un pedido anterior, ofrecida con "¿Te lo llevamos a…?". */
  direccionSugerida?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  /** Nota que el cliente escribió al mandar el carrito del catálogo. */
  nota?: string;
  /** Franja elegida: 'ya' (lo antes posible) o 'HH:MM' en hora de Bogotá. */
  entrega?: string;
  /** Paso `adicionales`: el adicional ya elegido (id del producto) mientras se elige la pizza. */
  adicionalProductoId?: string;
}

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
