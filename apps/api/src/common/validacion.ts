import type { ErrorDeCampo } from './problem-details.filter';

/** Devuelve el motivo del rechazo ("debe ser texto"), o null si el valor sirve. */
export type Regla = (valor: unknown) => string | null;
export type Esquema = Record<string, Regla>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const TEXTO_MAX_DEFECTO = 500;

/** `YYYY-MM-DD` que además existe en el calendario (rechaza 2026-02-31). */
export function esFechaValida(valor: string): boolean {
  const m = FECHA.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

export const texto =
  ({ min = 1, max = TEXTO_MAX_DEFECTO } = {}): Regla =>
  (valor) => {
    if (typeof valor !== 'string') return 'debe ser texto';
    const largo = valor.trim().length;
    if (largo < min) {
      return min === 1
        ? 'no puede estar vacío'
        : `debe tener al menos ${min} caracteres`;
    }
    return largo > max ? `no puede pasar de ${max} caracteres` : null;
  };

export const numero =
  ({ min = -Infinity, max = Infinity, entero = false } = {}): Regla =>
  (valor) => {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return 'debe ser un número';
    }
    if (entero && !Number.isInteger(valor)) return 'debe ser un número entero';
    if (valor < min) return `debe ser mayor o igual a ${min}`;
    return valor > max ? `debe ser menor o igual a ${max}` : null;
  };

export const booleano = (): Regla => (valor) =>
  typeof valor === 'boolean' ? null : 'debe ser verdadero o falso';

export const uuid = (): Regla => (valor) =>
  typeof valor === 'string' && UUID.test(valor)
    ? null
    : 'debe ser un identificador válido';

export const fecha = (): Regla => (valor) =>
  typeof valor === 'string' && esFechaValida(valor)
    ? null
    : 'debe ser una fecha con formato AAAA-MM-DD';

export const enumerado =
  (permitidos: readonly string[]): Regla =>
  (valor) =>
    typeof valor === 'string' && permitidos.includes(valor)
      ? null
      : `debe ser uno de: ${permitidos.join(', ')}`;

/** El campo puede faltar (o venir null); si viene, tiene que cumplir la regla. */
export const opcional =
  (regla: Regla): Regla =>
  (valor) =>
    valor === undefined || valor === null ? null : regla(valor);

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Valida un objeto contra un esquema y devuelve TODOS los errores juntos
 * (no solo el primero). Con `estricto`, un campo que el esquema no conoce
 * también es error: así un typo del cliente no se pierde en silencio.
 */
export function validarObjeto(
  esquema: Esquema,
  valor: unknown,
  estricto = true,
): ErrorDeCampo[] {
  if (!esObjetoPlano(valor)) {
    return [{ mensaje: 'El cuerpo debe ser un objeto JSON.' }];
  }
  const recibido = new Map(Object.entries(valor));
  const errores: ErrorDeCampo[] = [];

  for (const [campo, regla] of Object.entries(esquema)) {
    const motivo = regla(recibido.get(campo));
    if (motivo)
      errores.push({ campo, mensaje: `El campo "${campo}" ${motivo}.` });
  }
  if (estricto) {
    for (const campo of recibido.keys()) {
      if (!(campo in esquema)) {
        errores.push({
          campo,
          mensaje: `El campo "${campo}" no es válido aquí.`,
        });
      }
    }
  }
  return errores;
}
