import type { ProductoDto } from '../catalog/catalog.service';
import { MS_POR_HORA } from '../common/tiempo';
import { botonesPrecioProducto, esProductoPizza } from './texto-producto';
import type { BotonRespuesta } from './mensajes-interactivos';

/**
 * Segundo mensaje a quien llegó por un anuncio, preguntó por un producto y no
 * empezó el pedido (decisión del dueño, 16 nov 2026): uno solo, 2 horas
 * después de su último mensaje y siempre dentro de la ventana de 24 h de Meta
 * (con 1 hora de margen para no rozar el límite).
 */
export const HORAS_ESPERA_TOQUE = 2;
const HORAS_LIMITE_VENTANA = 23;

export interface CandidataToque {
  id: string;
  canal: 'messenger' | 'instagram';
  identificador_externo: string;
  interes_producto_id: string;
  interes_en: string;
}

/** Rango de `ultima_interaccion` de las conversaciones a las que ya toca escribirles. */
export function ventanaToque(ahora: Date): { desde: string; hasta: string } {
  return {
    desde: new Date(
      ahora.getTime() - HORAS_LIMITE_VENTANA * MS_POR_HORA,
    ).toISOString(),
    hasta: new Date(
      ahora.getTime() - HORAS_ESPERA_TOQUE * MS_POR_HORA,
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
