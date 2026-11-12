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

/**
 * Oferta del seguimiento automático (CLAUDE.md, sección 2): 10% en pizzas
 * personales para quien no respondió al recordatorio. Vale 24 horas desde que
 * se mandó y no se suma al 20% del día: si aplican las dos, gana el 20%.
 */
export const OFERTA_SEGUIMIENTO_PORCENTAJE = 10;
const HORAS_VIGENCIA_OFERTA = 24;

/** `dia`: 20% miércoles y jueves. `seguimiento`: 10% de la oferta por abandono. */
export type TipoPromocion = 'dia' | 'seguimiento';

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

function entraEnPromocion(l: LineaPromocion, tipo: TipoPromocion): boolean {
  if (!esPizza(l.producto_nombre, l.variante_nombre)) return false;
  return (
    tipo === 'dia' || l.variante_nombre?.trim().toLowerCase() === 'personal'
  );
}

function porcentajeDe(tipo: TipoPromocion): number {
  return tipo === 'dia' ? PROMO_PORCENTAJE : OFERTA_SEGUIMIENTO_PORCENTAJE;
}

/** El descuento sobre las pizzas que entran en la promoción, redondeado al peso. */
export function descuentoSobrePizzas(
  lineas: LineaPromocion[],
  tipo: TipoPromocion = 'dia',
): number {
  const valorPizzas = lineas
    .filter((l) => entraEnPromocion(l, tipo))
    .reduce((suma, l) => suma + l.subtotal, 0);
  return Math.round((valorPizzas * porcentajeDe(tipo)) / 100);
}

/** Descuento y notas de un pedido: sin promoción, 0 y las notas intactas. */
export function promocionDePedido(
  tipo: TipoPromocion | undefined,
  lineas: LineaPromocion[],
  notas: string | undefined,
): { descuento: number; notas: string | undefined } {
  if (!tipo) return { descuento: 0, notas };
  const descuento = descuentoSobrePizzas(lineas, tipo);
  return { descuento, notas: notasConPromocion(notas, descuento, tipo) };
}

/** ¿La oferta del seguimiento (ISO de cuándo se mandó) sigue valiendo? */
export function ofertaSeguimientoVigente(
  enviadaEn: string | null | undefined,
  ahora: Date,
): boolean {
  if (!enviadaEn) return false;
  const edad = ahora.getTime() - new Date(enviadaEn).getTime();
  return edad >= 0 && edad <= HORAS_VIGENCIA_OFERTA * MS_POR_HORA;
}

/** No se acumulan: el 20% del día gana sobre la oferta del seguimiento. */
export function elegirPromocion(
  promocionDelDia: boolean,
  ofertaVigente: boolean,
): TipoPromocion | undefined {
  if (promocionDelDia) return 'dia';
  return ofertaVigente ? 'seguimiento' : undefined;
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

export function textoDescuentoAplicado(
  descuento: number,
  tipo: TipoPromocion = 'dia',
): string {
  const etiqueta =
    tipo === 'dia'
      ? `Descuento ${PROMO_PORCENTAJE}% en pizzas`
      : `Oferta ${OFERTA_SEGUIMIENTO_PORCENTAJE}% en pizzas personales`;
  return `${etiqueta}: -$${descuento.toLocaleString('es-CO')}`;
}

/** Las notas del pedido con el descuento anotado, para que el equipo vea por qué el total es menor. */
export function notasConPromocion(
  notas: string | undefined,
  descuento: number,
  tipo: TipoPromocion = 'dia',
): string | undefined {
  if (descuento <= 0) return notas;
  const anotado = textoDescuentoAplicado(descuento, tipo);
  return notas ? `${notas} | ${anotado}` : anotado;
}
