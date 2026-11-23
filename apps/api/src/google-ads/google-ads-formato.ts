const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** "$ 12.500" para los textos de las alertas. */
export function formatoPesos(valor: number): string {
  return PESOS.format(valor);
}
