import { Esquema, numero, opcional, texto } from '../common/validacion';

export const ESQUEMA_ABRIR_TURNO: Esquema = {
  monto_inicial: numero({ min: 0 }),
};

export const ESQUEMA_CERRAR_TURNO: Esquema = {
  monto_final_contado: opcional(numero({ min: 0 })),
  notas_cierre: opcional(texto({ max: 1000 })),
};
