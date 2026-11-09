import { esAdicional } from '../mensajeria/adicionales';
import { minutosBogota } from './horario';
import { MINUTOS_POR_HORA, MS_POR_HORA } from './tiempo';

/**
 * Descuento del 20% (decisión del dueño, nov 2026, ver CLAUDE.md sección 2):
 * solo miércoles y jueves, hasta las 8:00 p.m. (hora de Bogotá), y solo sobre
 * el valor de las pizzas — nunca sobre el domicilio ni sobre otros productos.
 * Hoy lo aplica el checkout del bot de Messenger e Instagram.
 */
export const PROMO_PORCENTAJE = 20;
export const PROMO_HORA_LIMITE = 20;

const MIERCOLES = 3;
const JUEVES = 4;
const DIAS_CON_PROMO = [MIERCOLES, JUEVES];
// Un precio cotizado se respeta un rato aunque el cliente tarde en pagar;
// pasado ese plazo ya no vale (no sirve un botón viejo para pagar con descuento).
const HORAS_VIGENCIA_COTIZACION = 2;
const TAMANOS_DE_PIZZA = new Set(['personal', 'mediana', 'grande']);

const DIA_BOGOTA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  weekday: 'short',
});
const INDICE_DIA = new Map(
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => [d, i]),
);

export interface LineaPromocion {
  producto_nombre: string;
  /** Vacío o null cuando el producto tiene una sola variante. */
  variante_nombre: string | null;
  subtotal: number;
}

/** 0 = domingo … 6 = sábado, en hora de Bogotá. */
export function diaSemanaBogota(ahora: Date): number {
  return INDICE_DIA.get(DIA_BOGOTA.format(ahora)) ?? 0;
}

export function promocionActiva(ahora: Date): boolean {
  return (
    DIAS_CON_PROMO.includes(diaSemanaBogota(ahora)) &&
    minutosBogota(ahora) < PROMO_HORA_LIMITE * MINUTOS_POR_HORA
  );
}

/** Una pizza es un producto con tamaño (personal, mediana o grande) que no es un adicional. */
export function esPizza(
  productoNombre: string,
  varianteNombre: string | null,
): boolean {
  if (esAdicional(productoNombre) || !varianteNombre) return false;
  return TAMANOS_DE_PIZZA.has(
    varianteNombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(),
  );
}

/** El 20% del valor de las pizzas de la lista, redondeado al peso. */
export function descuentoSobrePizzas(lineas: LineaPromocion[]): number {
  const valorPizzas = lineas
    .filter((l) => esPizza(l.producto_nombre, l.variante_nombre))
    .reduce((suma, l) => suma + l.subtotal, 0);
  return Math.round((valorPizzas * PROMO_PORCENTAJE) / 100);
}

/** Descuento y notas de un pedido: sin promoción pedida, 0 y las notas intactas. */
export function promocionDePedido(
  aplicar: boolean | undefined,
  lineas: LineaPromocion[],
  notas: string | undefined,
): { descuento: number; notas: string | undefined } {
  const descuento = aplicar ? descuentoSobrePizzas(lineas) : 0;
  return { descuento, notas: notasConPromocion(notas, descuento) };
}

/** ¿La promoción que se le mostró al cliente (ISO) sigue valiendo? */
export function cotizacionVigente(
  cotizadaEn: string | undefined,
  ahora: Date,
): boolean {
  if (!cotizadaEn) return false;
  const edad = ahora.getTime() - new Date(cotizadaEn).getTime();
  return edad >= 0 && edad <= HORAS_VIGENCIA_COTIZACION * MS_POR_HORA;
}

export function textoDescuentoAplicado(descuento: number): string {
  return `Descuento ${PROMO_PORCENTAJE}% en pizzas: -$${descuento.toLocaleString('es-CO')}`;
}

/** Las notas del pedido con el descuento anotado, para que el equipo vea por qué el total es menor. */
export function notasConPromocion(
  notas: string | undefined,
  descuento: number,
): string | undefined {
  if (descuento <= 0) return notas;
  const anotado = textoDescuentoAplicado(descuento);
  return notas ? `${notas} | ${anotado}` : anotado;
}
