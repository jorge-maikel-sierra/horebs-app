import type { EditarEmpleadoInput } from './empleados.service';

const CAMPOS_TEXTO_OPCIONAL = new Set([
  'apellido',
  'cedula',
  'cargo',
  'telefono',
  'correo',
]);

const CAMPOS_EDITABLES = new Set([
  'nombre',
  'usuario_id',
  'monto_semanal',
  'dias_esperados_semana',
  'activo',
  ...CAMPOS_TEXTO_OPCIONAL,
]);

function normalizar(campo: string, valor: unknown): unknown {
  if (typeof valor === 'string') {
    if (campo === 'nombre') return valor.trim();
    if (CAMPOS_TEXTO_OPCIONAL.has(campo)) return valor.trim() || null;
  }
  return campo === 'usuario_id' ? valor || null : valor;
}

/**
 * Columnas a actualizar a partir de lo que mandó el panel: solo las que
 * vinieron y están permitidas, el texto recortado (vacío queda null) y
 * `usuario_id` vacío desvincula al usuario.
 */
export function armarCambiosEmpleado(
  cambios: EditarEmpleadoInput,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(cambios)
      .filter(
        ([campo, valor]) => CAMPOS_EDITABLES.has(campo) && valor !== undefined,
      )
      .map(([campo, valor]) => [campo, normalizar(campo, valor)]),
  );
}
