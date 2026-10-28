import {
  Esquema,
  enumerado,
  numero,
  opcional,
  texto,
} from '../common/validacion';

export const ESQUEMA_ABRIR_TURNO: Esquema = {
  monto_inicial: numero({ min: 0 }),
};

export const ESQUEMA_CERRAR_TURNO: Esquema = {
  monto_final_contado: opcional(numero({ min: 0 })),
  notas_cierre: opcional(texto({ max: 1000 })),
};

/** `PATCH /turnos/actual`: cerrar es cambiar el estado del turno abierto. */
export const ESQUEMA_CERRAR_TURNO_ACTUAL: Esquema = {
  estado: enumerado(['cerrado']),
  ...ESQUEMA_CERRAR_TURNO,
};
