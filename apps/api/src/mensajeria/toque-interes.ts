import type { ProductoDto } from '../catalog/catalog.service';
import { MS_POR_HORA, MS_POR_MINUTO } from '../common/tiempo';
import { botonesPrecioProducto, esProductoPizza } from './texto-producto';
import type { BotonRespuesta } from './mensajes-interactivos';

/**
 * Segundo mensaje a quien llegó por un anuncio, preguntó por un producto y no
 * empezó el pedido: uno solo, 30 minutos después de su último mensaje
 * (mientras todavía tiene hambre; antes eran 2 horas y llegaba casi al cierre,
 * cambio pedido por el dueño el 25 nov 2026) y siempre dentro de la ventana de
 * 24 h de Meta (con 1 hora de margen para no rozar el límite).
 */
export const MINUTOS_ESPERA_TOQUE = 30;
const HORAS_LIMITE_VENTANA = 23;

export interface CandidataToque {
  id: string;
  canal: 'messenger' | 'instagram';
  identificador_externo: string;
  interes_producto_id: string;
  interes_en: string;
  derivado_en: string | null;
}

/**
 * Pasó a una persona después de ver el producto: el 21 nov 2026 le llegó
 * "¿te animas?" a un cliente cuyo pedido el equipo tomó por teléfono.
 */
export function derivadoTrasInteres(c: CandidataToque): boolean {
  return (
    c.derivado_en !== null &&
    new Date(c.derivado_en).getTime() >= new Date(c.interes_en).getTime()
  );
}

/** Rango de `ultima_interaccion` de las conversaciones a las que ya toca escribirles. */
export function ventanaToque(ahora: Date): { desde: string; hasta: string } {
  return {
    desde: new Date(
      ahora.getTime() - HORAS_LIMITE_VENTANA * MS_POR_HORA,
    ).toISOString(),
    hasta: new Date(
      ahora.getTime() - MINUTOS_ESPERA_TOQUE * MS_POR_MINUTO,
    ).toISOString(),
  };
}

export function mensajeToque(producto: ProductoDto): {
  texto: string;
  botones: BotonRespuesta[];
} {
  const articulo = esProductoPizza(producto) ? 'la' : 'el';
  const pide = esProductoPizza(producto)
    ? 'Elige el tamaño y te la dejo en el pedido'
    : 'Toca el que quieras y te lo dejo en el pedido';
  return {
    texto: `¿Te animas con ${articulo} ${producto.nombre}? 🍕 ${pide} 👇`,
    botones: botonesPrecioProducto(producto),
  };
}
