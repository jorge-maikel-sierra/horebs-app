import {
  enumerado,
  lista,
  numero,
  opcional,
  texto,
  uuid,
  type Esquema,
} from '../common/validacion';
import { EVENTOS_WEB } from './eventos-web';

const LARGO_MAX_COOKIE = 300;
const LARGO_MAX_URL = 500;

export const ESQUEMA_EVENTO_WEB: Esquema = {
  event_name: enumerado(EVENTOS_WEB),
  event_id: uuid(),
  url: texto({ max: LARGO_MAX_URL }),
  fbp: opcional(texto({ max: LARGO_MAX_COOKIE })),
  fbc: opcional(texto({ max: LARGO_MAX_COOKIE })),
  value: opcional(numero({ min: 0 })),
  content_ids: opcional(lista()),
};
