import { Esquema, numero, texto } from '../common/validacion';

export const ESQUEMA_AJUSTE_PUNTOS: Esquema = {
  // Puede ser negativo; el cero lo rechaza el service.
  puntos: numero({ entero: true }),
  motivo: texto({ max: 300 }),
};
