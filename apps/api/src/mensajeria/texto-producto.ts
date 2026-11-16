import type { ProductoDto } from '../catalog/catalog.service';
import {
  PROMO_HORA_LIMITE,
  PROMO_PORCENTAJE,
  esPizza,
  promocionActiva,
} from '../common/promocion';
import { esAdicional } from './adicionales';
import {
  BOTON_SOCIAL,
  PREFIJO_VARIANTE_SOCIAL,
  botonesDeTamano,
  precioVariante,
  variantesOrdenadas,
} from './opciones-social';
import type { BotonRespuesta } from './mensajes-interactivos';
import { pesos } from './resumen-pedido';
import { medidaDe, type MedidaTamano } from './tamanos-pizza';

// CLAUDE.md, sección 2: la Horebs Especial se posiciona como "firma de la casa".
const FIRMA_DE_LA_CASA = /horebs especial/i;
const HORA_12 = 12;
const MAX_MENSAJES_CONTEXTO = 3;

const BOTON_VER_MENU: BotonRespuesta = {
  id: BOTON_SOCIAL.menu,
  titulo: '📋 Ver menú',
};

export function esProductoPizza(producto: ProductoDto): boolean {
  return producto.variantes.some((v) => esPizza(producto.nombre, v.nombre));
}

function lineaPromocion(producto: ProductoDto, ahora: Date): string | null {
  if (!esProductoPizza(producto) || !promocionActiva(ahora)) return null;
  return `🎉 Hoy tienes ${PROMO_PORCENTAJE}% de descuento en pizzas hasta las ${PROMO_HORA_LIMITE - HORA_12}:00 p.m., y se aplica solo al pedir por aquí.`;
}

/**
 * El precio de un producto pensado para que el cliente pida: cada tamaño con
 * sus porciones, el 20% si está activo y una invitación a tocar el tamaño.
 */
export function textoPrecioProducto(
  producto: ProductoDto,
  ahora: Date,
): string {
  const pizza = esProductoPizza(producto);
  const encabezado = FIRMA_DE_LA_CASA.test(producto.nombre)
    ? `${producto.nombre}, la firma de la casa 🍕`
    : `${producto.nombre} 🍕`;
  const lineas = variantesOrdenadas(producto).map((v) => {
    const medida = medidaDe(v.nombre);
    const porciones = pizza && medida ? ` (${medida.porciones} porciones)` : '';
    return `• ${v.nombre} ${pesos(precioVariante(v))}${porciones}`;
  });
  const cierre = pizza
    ? 'Toca el tamaño y te la agrego al pedido 👇'
    : 'Toca el que quieras y te lo agrego al pedido 👇';
  return [encabezado, ...lineas, lineaPromocion(producto, ahora), cierre]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/** Un botón por tamaño (con su precio) y "Ver menú". */
export function botonesPrecioProducto(producto: ProductoDto): BotonRespuesta[] {
  return [...botonesDeTamano(producto), BOTON_VER_MENU];
}

/** "La Pizza Hawaiana mediana trae 8 porciones (30 cm) y vale $35.000". null si no tiene ese tamaño. */
export function respuestaTamanoProducto(
  producto: ProductoDto,
  medida: MedidaTamano,
): { texto: string; botones: BotonRespuesta[] } | null {
  const variante = producto.variantes.find(
    (v) => medidaDe(v.nombre)?.nombre === medida.nombre,
  );
  if (!variante) return null;
  const tamano = medida.nombre.toLowerCase();
  return {
    texto: `La ${producto.nombre} ${tamano} trae ${medida.porciones} porciones (${medida.centimetros} cm) y vale ${pesos(precioVariante(variante))} 🍕\n¿Te la agrego al pedido?`,
    botones: [
      {
        id: `${PREFIJO_VARIANTE_SOCIAL}${variante.id}`,
        titulo: `🛒 Pedir ${tamano}`,
      },
      ...botonesDeTamano(producto).filter(
        (b) => b.id !== `${PREFIJO_VARIANTE_SOCIAL}${variante.id}`,
      ),
      BOTON_VER_MENU,
    ],
  };
}

/**
 * El producto del que se viene hablando: el único nombrado en los últimos
 * mensajes del bot (del más reciente al más viejo). Si un mensaje nombra
 * varios (el menú, las más pedidas), no hay uno claro y devuelve null.
 */
export function productoEnContexto(
  mensajesBot: string[],
  productos: ProductoDto[],
): ProductoDto | null {
  const candidatos = productos.filter((p) => !esAdicional(p.nombre));
  for (const texto of mensajesBot.slice(0, MAX_MENSAJES_CONTEXTO)) {
    const t = texto.toLowerCase();
    const nombrados = candidatos.filter((p) =>
      t.includes(p.nombre.toLowerCase()),
    );
    if (nombrados.length === 1) return nombrados[0];
    if (nombrados.length > 1) return null;
  }
  return null;
}
