const LARGO_ID_CORTO = 8;

/** Los primeros caracteres del uuid: el número que ve el cliente (`#1a2b3c4d`). */
export function idCortoPedido(id: string): string {
  return id.slice(0, LARGO_ID_CORTO);
}
