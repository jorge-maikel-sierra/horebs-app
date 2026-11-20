export const ESTADOS_RESENA = [
  'pendiente',
  'para_revisar',
  'respondida',
  'descartada',
  'error',
] as const;

export type EstadoResena = (typeof ESTADOS_RESENA)[number];

/** Reseña tal como la devuelve la API v4 de Google Business Profile. */
export interface ResenaGoogle {
  name: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime?: string };
}

/** Fila de `resenas_google`. */
export interface ResenaDto {
  id: string;
  google_id: string;
  autor: string | null;
  estrellas: number;
  comentario: string | null;
  creada_en: string;
  estado: EstadoResena;
  respuesta: string | null;
  respondida_en: string | null;
  error: string | null;
}

export type NuevaResena = Omit<ResenaDto, 'id' | 'error'>;

export interface ActualizarResenaInput {
  estado: 'respondida' | 'descartada';
  respuesta?: string;
}
