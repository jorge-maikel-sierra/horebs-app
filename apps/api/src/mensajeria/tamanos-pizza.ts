/**
 * Tamaños de pizza (CLAUDE.md, sección 2): de acá salen el texto que recibe
 * el modelo con obtener_tamanos_pizza y las porciones que muestra el bot de
 * Messenger e Instagram junto a cada precio.
 */
export interface MedidaTamano {
  nombre: 'Personal' | 'Mediana' | 'Grande';
  porciones: number;
  centimetros: number;
}

const PORCIONES_PERSONAL = 6;
const PORCIONES_MEDIANA = 8;
const PORCIONES_GRANDE = 12;
const CM_PERSONAL = 24;
const CM_MEDIANA = 30;
const CM_GRANDE = 40;

export const MEDIDAS_TAMANO: MedidaTamano[] = [
  {
    nombre: 'Personal',
    porciones: PORCIONES_PERSONAL,
    centimetros: CM_PERSONAL,
  },
  { nombre: 'Mediana', porciones: PORCIONES_MEDIANA, centimetros: CM_MEDIANA },
  { nombre: 'Grande', porciones: PORCIONES_GRANDE, centimetros: CM_GRANDE },
];

export const TEXTO_TAMANOS = MEDIDAS_TAMANO.map(
  (m) =>
    `${m.nombre}: ${m.porciones} porciones, ${m.centimetros} centímetros de diámetro.`,
).join(' ');

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** La medida de una variante ("Mediana" → 8 porciones, 30 cm); undefined si no es un tamaño de pizza. */
export function medidaDe(nombreVariante: string): MedidaTamano | undefined {
  const n = normalizar(nombreVariante);
  return MEDIDAS_TAMANO.find((m) => normalizar(m.nombre) === n);
}

/** El tamaño que nombra el cliente ("la mediana", "la de 40"); undefined si no nombra ninguno. */
export function tamanoMencionado(texto: string): MedidaTamano | undefined {
  const palabras = new Set(
    normalizar(texto)
      .replace(/(\d+)\s*cm\b/g, '$1')
      .split(/[^a-z0-9]+/),
  );
  return MEDIDAS_TAMANO.find(
    (m) =>
      palabras.has(normalizar(m.nombre)) || palabras.has(String(m.centimetros)),
  );
}
