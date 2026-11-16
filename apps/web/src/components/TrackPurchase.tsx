'use client';

import { useEffect } from 'react';
import { trackPurchase } from '@/lib/analytics';

type PedidoItem = {
  variante_id: string | null;
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
};

const CLAVE_PEDIDOS_TRACKEADOS = 'horebs-compras-trackeadas';
// Lo escribe el checkout justo antes de venir acá (ver `marcarCompraNueva`).
const PREFIJO_COMPRA_NUEVA = 'horebs-compra-nueva:';

/** El checkout avisa que este pedido se acaba de hacer en este navegador. */
export function marcarCompraNueva(pedidoId: string) {
  try {
    sessionStorage.setItem(`${PREFIJO_COMPRA_NUEVA}${pedidoId}`, '1');
  } catch {
    // Sin sessionStorage no se puede marcar: la compra no se cuenta en el
    // navegador y queda solo el envío del servidor, que no depende de esto.
  }
}

/** true una sola vez: abrir el link del pedido después (o en otro teléfono) no es una compra. */
function esCompraNueva(pedidoId: string): boolean {
  try {
    const clave = `${PREFIJO_COMPRA_NUEVA}${pedidoId}`;
    const nueva = sessionStorage.getItem(clave) !== null;
    sessionStorage.removeItem(clave);
    return nueva;
  } catch {
    return false;
  }
}

/**
 * Sin render — dispara purchase una sola vez por pedido, y solo si el
 * cliente llegó desde el checkout. Esta página se puede recargar, abrir con
 * el link guardado o desde otro teléfono sin volver a contar la venta (así
 * el píxel contaba 17 compras con 6 pedidos). El id ya reportado también
 * queda en localStorage como segunda defensa.
 */
export default function TrackPurchase({
  id,
  total,
  costoDomicilio,
  items,
}: {
  id: string;
  total: number;
  costoDomicilio: number;
  items: PedidoItem[];
}) {
  useEffect(() => {
    if (!esCompraNueva(id)) return;
    let yaTrackeados: string[] = [];
    try {
      yaTrackeados = JSON.parse(localStorage.getItem(CLAVE_PEDIDOS_TRACKEADOS) ?? '[]');
    } catch {
      // localStorage corrupto — se sigue de largo, en el peor caso se
      // reporta esta compra una vez más de lo ideal, nunca de menos.
    }
    if (yaTrackeados.includes(id)) return;

    trackPurchase({
      id,
      total,
      costoDomicilio,
      items: items.map((i) => ({
        varianteId: i.variante_id,
        productoNombre: i.producto_nombre,
        varianteNombre: i.variante_nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
      })),
    });

    try {
      localStorage.setItem(
        CLAVE_PEDIDOS_TRACKEADOS,
        JSON.stringify([...yaTrackeados, id].slice(-50)),
      );
    } catch {
      // Si no se puede persistir, el peor caso es un posible doble
      // conteo en una recarga futura — no vale la pena romper la página.
    }
    // Solo depende de `id`: total/costoDomicilio/items son estables para
    // un mismo pedido (vienen de un solo fetch del servidor) — no hace
    // falta re-disparar el efecto si la referencia del array cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return null;
}
