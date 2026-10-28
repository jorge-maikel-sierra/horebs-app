import {
  Esquema,
  booleano,
  fecha,
  numero,
  opcional,
  texto,
  uuid,
} from '../common/validacion';

export const ESQUEMA_ASISTENCIA: Esquema = {
  trabajo: booleano(),
  motivo: opcional(texto({ max: 300 })),
};

export const ESQUEMA_LIQUIDAR_SEMANA: Esquema = {
  notas: opcional(texto({ max: 1000 })),
};

const DATOS_EMPLEADO: Esquema = {
  apellido: opcional(texto({ max: 100 })),
  cedula: opcional(texto({ max: 30 })),
  cargo: opcional(texto({ max: 100 })),
  telefono: opcional(texto({ max: 30 })),
  correo: opcional(texto({ max: 200 })),
  usuario_id: opcional(uuid()),
  monto_semanal: numero({ min: 1 }),
  dias_esperados_semana: numero({ min: 1, max: 7, entero: true }),
};

export const ESQUEMA_CREAR_EMPLEADO: Esquema = {
  nombre: texto({ max: 100 }),
  ...DATOS_EMPLEADO,
  dias_esperados_semana: opcional(DATOS_EMPLEADO.dias_esperados_semana),
};

/** `PATCH /nomina/empleados/:id`: todo es opcional, incluido activar o desactivar. */
export const ESQUEMA_EDITAR_EMPLEADO: Esquema = Object.fromEntries(
  Object.entries({
    ...DATOS_EMPLEADO,
    nombre: texto({ max: 100 }),
    activo: booleano(),
  }).map(([campo, regla]) => [campo, opcional(regla)]),
);

export const ESQUEMA_REGISTRAR_ADELANTO: Esquema = {
  empleado_id: uuid(),
  monto: numero({ min: 1 }),
  fecha: fecha(),
  motivo: opcional(texto({ max: 300 })),
};
