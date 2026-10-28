import {
  Esquema,
  booleano,
  enumerado,
  numero,
  opcional,
  texto,
} from '../common/validacion';

export const ESQUEMA_MODULO: Esquema = {
  activo: booleano(),
};

export const ESQUEMA_ASIGNAR_ROL: Esquema = {
  email: texto({ max: 254 }),
  rol: enumerado(['admin', 'empleado']),
  cedula: opcional(texto({ max: 20 })),
};

export const ESQUEMA_SEGUIMIENTO_CONFIG: Esquema = {
  recordatorio_minutos: numero({ min: 1, entero: true }),
  oferta_minutos: numero({ min: 1, entero: true }),
};

export const ESQUEMA_ESTADO_CONVERSACION: Esquema = {
  estado: texto({ max: 30 }),
};

export const ESQUEMA_MENSAJE_CONVERSACION: Esquema = {
  texto: texto({ max: 4000 }),
};
