import {
  Esquema,
  enumerado,
  numero,
  opcional,
  texto,
  uuid,
} from '../common/validacion';

export const ESQUEMA_AJUSTE_INSUMO: Esquema = {
  tipo: enumerado(['ajuste', 'merma']),
  // Puede ser negativo (ajuste hacia abajo); el cero lo rechaza el service.
  cantidad_g: numero(),
  motivo: texto({ max: 300 }),
};

export const ESQUEMA_VINCULAR_DETALLE: Esquema = {
  insumo_id: uuid(),
};

/** `PATCH .../detalles/:id`: vincular un insumo y/o cambiar el estado. */
export const ESQUEMA_ACTUALIZAR_DETALLE: Esquema = {
  estado: opcional(enumerado(['procesado', 'excluido'])),
  insumo_id: opcional(uuid()),
};
