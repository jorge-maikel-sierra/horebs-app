/** Campañas propias (sin Meta Ads): lo que devuelve `/admin/campanas-mensajeria`. */
export type CanalCampana =
  | 'whatsapp_business'
  | 'whatsapp_bot'
  | 'messenger'
  | 'instagram';

export const CANALES_CAMPANA: CanalCampana[] = [
  'whatsapp_business',
  'whatsapp_bot',
  'messenger',
  'instagram',
];

export const CANAL_CAMPANA_LABEL: Record<CanalCampana, string> = {
  whatsapp_business: 'WhatsApp Business',
  whatsapp_bot: 'Bot de WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

export type CampanaMensajeria = {
  id: string;
  nombre: string;
  canal: CanalCampana;
  mensaje: string;
  creativo_url: string | null;
  creativo_tipo: 'imagen' | 'video' | null;
  enviada_en: string;
  costo: number | null;
  destinatarios: number | null;
  activa: boolean;
  created_at: string;
};

export type ResultadoCampana = {
  campana_id: string;
  pedidos: number;
  ventas: number;
  clientes: number;
  utilidad_bruta: number;
  cobertura_costos: number | null;
  costo_por_pedido: number | null;
  roas: number | null;
  retorno_utilidad: number | null;
};

export type CampanaConResultado = CampanaMensajeria & {
  resultado: ResultadoCampana;
};

/** Día de envío (AAAA-MM-DD) en hora de Bogotá, para el formulario. */
export function diaBogota(fecha: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date(fecha));
}
