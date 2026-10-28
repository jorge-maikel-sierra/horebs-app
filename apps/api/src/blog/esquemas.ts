import { Esquema, texto } from '../common/validacion';
import { MAX_LARGO_COMENTARIO } from './blog.service';

export const ESQUEMA_COMENTARIO: Esquema = {
  contenido: texto({ max: MAX_LARGO_COMENTARIO }),
};
