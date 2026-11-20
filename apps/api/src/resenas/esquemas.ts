import { enumerado, opcional, texto, type Esquema } from '../common/validacion';

/** Google acepta respuestas de hasta 4096 bytes; 3000 caracteres deja margen para tildes y emojis. */
const MAX_RESPUESTA = 3000;

export const ESQUEMA_ACTUALIZAR_RESENA: Esquema = {
  estado: enumerado(['respondida', 'descartada']),
  respuesta: opcional(texto({ max: MAX_RESPUESTA })),
};
