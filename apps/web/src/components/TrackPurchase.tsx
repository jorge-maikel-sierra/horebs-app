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

/**
 * Sin render — dispara purchase una sola vez por pedido. Esta página se
 * puede recargar (o el cliente volver con el link guardado) sin volver a
 * contar la misma venta: se guarda el id del pedido ya reportado en
 * localStorage antes de disparar el evento.
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
