import { METODOS_PAGO } from '../common/metodos-pago';
import {
  Esquema,
  booleano,
  enumerado,
  fecha,
  lista,
  numero,
  objeto,
  opcional,
  texto,
  uuid,
} from '../common/validacion';
import {
  CANALES_CAMPANA,
  EXTENSIONES_CREATIVO,
} from './campanas-mensajeria.tipos';
import {
  ESTADOS_PEDIDO,
  MODALIDADES_VENTA,
  ORIGENES_VENTA,
} from './pedidos-admin.tipos';

/** `cliente` e `items` traen objetos anidados: el service los valida campo por campo. */
export const ESQUEMA_VENTA: Esquema = {
  cliente: objeto(),
  modalidad: enumerado(MODALIDADES_VENTA),
  direccion_entrega: opcional(texto({ max: 300 })),
  costo_domicilio: opcional(numero({ min: 0 })),
  metodo_pago: enumerado(METODOS_PAGO),
  notas: opcional(texto({ max: 1000 })),
  origen: opcional(enumerado([...ORIGENES_VENTA])),
  origen_campana_id: opcional(texto({ max: 64 })),
  campana_mensajeria_id: opcional(uuid()),
  items: lista(),
  usar_puntos: opcional(booleano()),
};

const MAX_COSTO_CAMPANA = 100_000_000;
const NOMBRE_CAMPANA = texto({ max: 120 });
const CANAL_CAMPANA = enumerado(CANALES_CAMPANA);
const MENSAJE_CAMPANA = texto({ max: 4000 });
const COSTO_CAMPANA = opcional(numero({ min: 0, max: MAX_COSTO_CAMPANA }));
const DESTINATARIOS_CAMPANA = opcional(numero({ min: 0, entero: true }));

export const ESQUEMA_CREAR_CAMPANA_MENSAJERIA: Esquema = {
  nombre: NOMBRE_CAMPANA,
  canal: CANAL_CAMPANA,
  mensaje: MENSAJE_CAMPANA,
  enviada_en: fecha(),
  costo: COSTO_CAMPANA,
  destinatarios: DESTINATARIOS_CAMPANA,
};

export const ESQUEMA_EDITAR_CAMPANA_MENSAJERIA: Esquema = {
  nombre: opcional(NOMBRE_CAMPANA),
  canal: opcional(CANAL_CAMPANA),
  mensaje: opcional(MENSAJE_CAMPANA),
  enviada_en: opcional(fecha()),
  costo: COSTO_CAMPANA,
  destinatarios: DESTINATARIOS_CAMPANA,
  activa: opcional(booleano()),
};

export const ESQUEMA_SUBIR_CREATIVO: Esquema = {
  extension: enumerado(EXTENSIONES_CREATIVO),
};

/** Costo de producto de una variante en pesos; quitarlo es un DELETE. */
export const ESQUEMA_COSTO: Esquema = {
  costo: numero({ min: 0 }),
};

export const ESQUEMA_MODULO: Esquema = {
  activo: booleano(),
};

export const ESQUEMA_ASIGNAR_ROL: Esquema = {
  email: texto({ max: 254 }),
  rol: enumerado(['admin', 'empleado']),
  cedula: opcional(texto({ max: 20 })),
};

export const ESQUEMA_CONFIGURACION_CORREOS: Esquema = {
  correo_domiciliario: opcional(texto({ max: 254 })),
  correo_avisos_bot: opcional(texto({ max: 254 })),
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

export const ESQUEMA_PERFIL_MENSAJERIA: Esquema = {};
