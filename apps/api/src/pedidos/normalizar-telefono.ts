const LARGO_CON_PAIS = 12;
const PREFIJO_COLOMBIA = '57';

/**
 * Meta entrega el teléfono con código de país (573157861208); en
 * `clientes.telefono` se guarda solo el número local (3157861208).
 */
export function normalizarTelefonoCO(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (
    digitos.length === LARGO_CON_PAIS &&
    digitos.startsWith(PREFIJO_COLOMBIA)
  ) {
    return digitos.slice(PREFIJO_COLOMBIA.length);
  }
  return digitos;
}
