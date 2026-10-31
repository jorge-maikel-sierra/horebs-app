import { METODOS_PAGO } from '../common/metodos-pago';
import {
  Esquema,
  booleano,
  enumerado,
  lista,
  numero,
  opcional,
  texto,
} from '../common/validacion';
import { ESTADOS_PEDIDO } from './pedidos-admin.tipos';

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

/** `items` trae líneas anidadas: el service las valida una por una. */
export const ESQUEMA_EDITAR_PEDIDO: Esquema = {
  metodo_pago: opcional(enumerado(METODOS_PAGO)),
  estado: opcional(enumerado(ESTADOS_PEDIDO)),
  items: opcional(lista()),
};
