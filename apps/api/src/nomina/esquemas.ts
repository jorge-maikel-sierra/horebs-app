import { Esquema, booleano, opcional, texto } from '../common/validacion';

export const ESQUEMA_ASISTENCIA: Esquema = {
  trabajo: booleano(),
  motivo: opcional(texto({ max: 300 })),
};

export const ESQUEMA_LIQUIDAR_SEMANA: Esquema = {
  notas: opcional(texto({ max: 1000 })),
};
