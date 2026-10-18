/**
 * Porciones y diámetro de cada tamaño de pizza, confirmados por el negocio
 * (ver CLAUDE.md). Se buscan por el nombre de la variante; si una variante
 * no se llama así (bebidas, panzerottis), simplemente no se muestra el dato.
 */
export const TAMANOS: Record<string, { porciones: number; cm: number }> = {
  Personal: { porciones: 6, cm: 24 },
  Mediana: { porciones: 8, cm: 30 },
  Grande: { porciones: 12, cm: 40 },
};
