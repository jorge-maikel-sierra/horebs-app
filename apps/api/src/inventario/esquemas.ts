import {
  Esquema,
  booleano,
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

/** `PATCH .../detalles/:id`: vincular un insumo y/o cambiar el estado. */
export const ESQUEMA_ACTUALIZAR_DETALLE: Esquema = {
  estado: opcional(enumerado(['procesado', 'excluido'])),
  insumo_id: opcional(uuid()),
};

const UNIDADES_MEDIDA = ['g', 'ml', 'unidad'];

export const ESQUEMA_CREAR_INSUMO: Esquema = {
  nombre: texto({ max: 100 }),
  categoria: texto({ max: 100 }),
  unidad_medida: opcional(enumerado(UNIDADES_MEDIDA)),
  stock_minimo_g: opcional(numero({ min: 0 })),
  proveedor_principal: opcional(texto({ max: 200 })),
};

/** `PATCH /inventario/insumos/:id`: todo es opcional. */
export const ESQUEMA_EDITAR_INSUMO: Esquema = {
  nombre: opcional(texto({ max: 100 })),
  categoria: opcional(texto({ max: 100 })),
  unidad_medida: opcional(enumerado(UNIDADES_MEDIDA)),
  stock_minimo_g: opcional(numero({ min: 0 })),
  proveedor_principal: opcional(texto({ max: 200 })),
  activo: opcional(booleano()),
};
