import type { FilaItemCosto } from './rentabilidad';

/**
 * Campañas propias que no pasan por Meta Ads (difusiones de WhatsApp
 * Business, campañas por el bot de WhatsApp, Messenger e Instagram).
 */
export const CANALES_CAMPANA = [
  'whatsapp_business',
  'whatsapp_bot',
  'messenger',
  'instagram',
] as const;
export type CanalCampana = (typeof CANALES_CAMPANA)[number];

export const TIPOS_CREATIVO = ['imagen', 'video'] as const;
export type TipoCreativo = (typeof TIPOS_CREATIVO)[number];

/** Extensión del archivo → tipo de creativo y tipo MIME para la subida. */
export const FORMATOS_CREATIVO = {
  jpg: { tipo: 'imagen', mime: 'image/jpeg' },
  png: { tipo: 'imagen', mime: 'image/png' },
  webp: { tipo: 'imagen', mime: 'image/webp' },
  mp4: { tipo: 'video', mime: 'video/mp4' },
  mov: { tipo: 'video', mime: 'video/quicktime' },
} as const satisfies Record<string, { tipo: TipoCreativo; mime: string }>;
export type ExtensionCreativo = keyof typeof FORMATOS_CREATIVO;
export const EXTENSIONES_CREATIVO = Object.keys(
  FORMATOS_CREATIVO,
) as ExtensionCreativo[];

export interface FilaCampanaMensajeria {
  id: string;
  nombre: string;
  canal: CanalCampana;
  mensaje: string;
  creativo_path: string | null;
  creativo_tipo: TipoCreativo | null;
  enviada_en: string;
  costo: number | string | null;
  destinatarios: number | null;
  activa: boolean;
  created_at: string;
}

export interface CampanaMensajeriaDto extends Omit<
  FilaCampanaMensajeria,
  'costo'
> {
  costo: number | null;
  /** URL pública del creativo; null si la campaña no lleva. */
  creativo_url: string | null;
}

export interface CrearCampanaInput {
  nombre: string;
  canal: CanalCampana;
  mensaje: string;
  /** Día del envío (AAAA-MM-DD, hora de Bogotá). */
  enviada_en: string;
  costo?: number | null;
  destinatarios?: number | null;
}

export interface EditarCampanaInput extends Partial<CrearCampanaInput> {
  activa?: boolean;
}

export interface SubirCreativoInput {
  extension: ExtensionCreativo;
}

export interface SubidaCreativoDto {
  /** URL firmada: el navegador sube el archivo con un PUT directo a Storage. */
  url_subida: string;
  creativo_url: string;
  creativo_tipo: TipoCreativo;
  mime: string;
}

export interface FilaPedidoCampana {
  id: string;
  total: number | string;
  estado: string;
  cliente_id: string | null;
  campana_mensajeria_id: string;
  items_pedido: FilaItemCosto[] | null;
}

export interface ResultadoCampanaDto {
  campana_id: string;
  pedidos: number;
  ventas: number;
  clientes: number;
  /** Ventas de productos menos su costo, en los pedidos con costo completo. */
  utilidad_bruta: number;
  /** Qué parte de las ventas de productos ya tiene costo cargado. */
  cobertura_costos: number | null;
  /** null si la campaña no tiene costo o todavía no trajo pedidos. */
  costo_por_pedido: number | null;
  /** Ventas entre costo de la campaña. */
  roas: number | null;
  /** Utilidad bruta entre costo: lo que deja cada peso invertido. */
  retorno_utilidad: number | null;
}
