import type { ProductoDto } from '../catalog/catalog.service';
import type { ItemCarritoPendiente } from './conversaciones.tipos';
import type { BotonRespuesta } from './mensajes-interactivos';
import { pesos } from './resumen-pedido';

/**
 * Ids de las opciones rápidas de Messenger e Instagram. El prefijo dice quién
 * las atiende: `mnu:` el menú de inicio, `ped:` el pedido por botones y
 * `cat:` las categorías (ver `esBotonSocial` en el parser).
 */
export const BOTON_SOCIAL = {
  menu: 'mnu:menu',
  pedir: 'mnu:pedir',
  horario: 'mnu:horario',
  descuento: 'mnu:descuento',
  humano: 'mnu:humano',
  mas: 'ped:mas',
  fin: 'ped:fin',
  vaciar: 'ped:vaciar',
  repetir: 'ped:repetir',
} as const;

export const PREFIJO_CATEGORIA = 'cat:';
export const PREFIJO_PRODUCTO_SOCIAL = 'ped:p:';
export const PREFIJO_VARIANTE_SOCIAL = 'ped:v:';
export const PREFIJO_CANTIDAD_SOCIAL = 'ped:q:';

// Cuántos botones de cantidad se ofrecen (1 a 4); para más, el cliente escribe.
const BOTONES_DE_CANTIDAD = 4;
export const CANTIDADES_SOCIAL = Array.from(
  { length: BOTONES_DE_CANTIDAD },
  (_, i) => i + 1,
);
// Mismo tope que valida calcular_pedido para un carrito.
export const MAX_CANTIDAD_ITEM = 20;

const PRIMERAS_OPCIONES = 2;

/** Lo que se ofrece al terminar una respuesta fija: mantiene al cliente en el camino de la venta. */
export const BOTONES_INICIO: BotonRespuesta[] = [
  { id: BOTON_SOCIAL.menu, titulo: '🍕 Ver menú' },
  { id: BOTON_SOCIAL.pedir, titulo: '🛒 Hacer un pedido' },
  { id: BOTON_SOCIAL.horario, titulo: '🕓 Horario' },
  { id: BOTON_SOCIAL.repetir, titulo: '🔁 Repetir pedido' },
  { id: BOTON_SOCIAL.descuento, titulo: '🎉 Descuento 20%' },
  { id: BOTON_SOCIAL.humano, titulo: '💬 Una persona' },
];

/** Tras mostrar el precio de un producto: ver el menú y hacer un pedido. */
export const BOTONES_TRAS_PRECIO: BotonRespuesta[] = BOTONES_INICIO.slice(
  0,
  PRIMERAS_OPCIONES,
);

export const BOTONES_ARMAR_PEDIDO: BotonRespuesta[] = [
  { id: BOTON_SOCIAL.mas, titulo: '➕ Agregar otro' },
  { id: BOTON_SOCIAL.fin, titulo: '✅ Seguir pedido' },
  { id: BOTON_SOCIAL.vaciar, titulo: '🗑️ Vaciar' },
];

export function precioVariante(v: {
  precio: number;
  precio_oferta: number | null;
}): number {
  return v.precio_oferta ?? v.precio;
}

/** Los tamaños de un producto, del más barato al más caro. */
export function variantesOrdenadas(
  producto: ProductoDto,
): ProductoDto['variantes'] {
  return [...producto.variantes].sort(
    (a, b) => precioVariante(a) - precioVariante(b),
  );
}

export function botonesDeTamano(producto: ProductoDto): BotonRespuesta[] {
  return variantesOrdenadas(producto).map((v) => ({
    id: `${PREFIJO_VARIANTE_SOCIAL}${v.id}`,
    titulo: `${v.nombre} ${pesos(precioVariante(v))}`,
  }));
}

export function botonesDeCantidad(varianteId: string): BotonRespuesta[] {
  return CANTIDADES_SOCIAL.map((n) => ({
    id: `${PREFIJO_CANTIDAD_SOCIAL}${varianteId}:${n}`,
    titulo: String(n),
  }));
}

/** "Pizza Hawaiana: Personal $20.000 · Mediana $35.000 · Grande $45.000". */
export function lineaDePrecios(producto: ProductoDto): string {
  const precios = variantesOrdenadas(producto)
    .map((v) => `${v.nombre} ${pesos(precioVariante(v))}`)
    .join(' · ');
  return `${producto.nombre}: ${precios}`;
}

/**
 * Tras sugerir las más pedidas: un botón por pizza ("🍕 Hawaiana", sin el
 * "Pizza " para que quepa en una opción rápida), el menú completo y una persona.
 */
export function botonesMasPedidas(pizzas: ProductoDto[]): BotonRespuesta[] {
  return [
    ...pizzas.map((p) => ({
      id: `${PREFIJO_PRODUCTO_SOCIAL}${p.id}`,
      titulo: `🍕 ${p.nombre.replace(/^Pizza (de )?/i, '')}`,
    })),
    { id: BOTON_SOCIAL.menu, titulo: '📋 Ver menú completo' },
    { id: BOTON_SOCIAL.humano, titulo: '💬 Una persona' },
  ];
}

/** Suma una cantidad al carrito; si la variante ya estaba, la acumula hasta el tope. */
export function sumarItem(
  items: ItemCarritoPendiente[],
  varianteId: string,
  cantidad: number,
): ItemCarritoPendiente[] {
  const existe = items.some((i) => i.varianteId === varianteId);
  if (!existe) return [...items, { varianteId, cantidad }];
  return items.map((i) =>
    i.varianteId === varianteId
      ? { ...i, cantidad: Math.min(i.cantidad + cantidad, MAX_CANTIDAD_ITEM) }
      : i,
  );
}

/** "ped:q:<variante>:<n>" → { varianteId, cantidad }, o null si no es válido. */
export function leerCantidad(
  resto: string,
): { varianteId: string; cantidad: number } | null {
  const corte = resto.lastIndexOf(':');
  if (corte <= 0) return null;
  const cantidad = Number(resto.slice(corte + 1));
  const valida =
    Number.isInteger(cantidad) &&
    cantidad >= 1 &&
    cantidad <= MAX_CANTIDAD_ITEM;
  return valida ? { varianteId: resto.slice(0, corte), cantidad } : null;
}
