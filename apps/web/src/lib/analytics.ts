'use client';

import { sendGTMEvent } from '@next/third-parties/google';

const MONEDA = 'COP';

type ItemCarrito = {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
};

type ItemGA4 = {
  item_id: string;
  item_name: string;
  item_variant: string;
  price: number;
  quantity: number;
};

/**
 * GA4 recomienda vaciar el objeto ecommerce anterior antes de empujar uno
 * nuevo — si no, un tag puede terminar leyendo items del evento previo.
 * https://developers.google.com/tag-platform/tag-manager/datalayer#ecommerce
 */
function limpiarEcommerceAnterior() {
  sendGTMEvent({ ecommerce: null });
}

function itemAGA4(item: ItemCarrito, quantity: number): ItemGA4 {
  return {
    item_id: item.varianteId,
    item_name: item.productoNombre,
    item_variant: item.varianteNombre,
    price: item.precio,
    quantity,
  };
}

/**
 * Único punto de entrada de medición del sitio: todo se empuja al
 * dataLayer de GTM. El Pixel de Facebook, GA4 y Google Ads se
 * configuran como tags DENTRO de GTM (leyendo estos mismos eventos),
 * no acá — así hay un solo medidor cargado en el sitio, nunca dos.
 */
export function trackViewItem(producto: {
  nombre: string;
  variantes: { id: string; nombre: string; precio: number; precio_oferta: number | null }[];
}) {
  if (producto.variantes.length === 0) return;

  const items = producto.variantes.map((v) =>
    itemAGA4(
      {
        varianteId: v.id,
        productoNombre: producto.nombre,
        varianteNombre: v.nombre,
        precio: v.precio_oferta ?? v.precio,
      },
      1,
    ),
  );
  const value = Math.min(...items.map((i) => i.price));

  limpiarEcommerceAnterior();
  sendGTMEvent({ event: 'view_item', ecommerce: { currency: MONEDA, value, items } });
}

export function trackAddToCart(item: ItemCarrito, cantidad: number) {
  const ga4Item = itemAGA4(item, cantidad);
  const value = item.precio * cantidad;

  limpiarEcommerceAnterior();
  sendGTMEvent({
    event: 'add_to_cart',
    ecommerce: { currency: MONEDA, value, items: [ga4Item] },
  });
}

export function trackBeginCheckout(items: (ItemCarrito & { cantidad: number })[], value: number) {
  if (items.length === 0) return;

  const ga4Items = items.map((i) => itemAGA4(i, i.cantidad));

  limpiarEcommerceAnterior();
  sendGTMEvent({
    event: 'begin_checkout',
    ecommerce: { currency: MONEDA, value, items: ga4Items },
  });
}

export function trackPurchase(pedido: {
  id: string;
  total: number;
  costoDomicilio: number;
  items: {
    varianteId: string | null;
    productoNombre: string;
    varianteNombre: string;
    cantidad: number;
    precioUnitario: number;
  }[];
}) {
  const ga4Items = pedido.items.map((i) =>
    itemAGA4(
      {
        // Los productos personalizados del POS (bordes, adicionales) no
        // tienen variante_id — usamos el nombre como id de respaldo en
        // vez de dejar el item afuera del reporte.
        varianteId: i.varianteId ?? i.productoNombre,
        productoNombre: i.productoNombre,
        varianteNombre: i.varianteNombre,
        precio: i.precioUnitario,
      },
      i.cantidad,
    ),
  );

  limpiarEcommerceAnterior();
  sendGTMEvent({
    event: 'purchase',
    ecommerce: {
      transaction_id: pedido.id,
      currency: MONEDA,
      value: pedido.total,
      shipping: pedido.costoDomicilio,
      items: ga4Items,
    },
  });
}

/** WhatsApp es el canal de contacto principal del sitio — se trackea como lead. */
export function trackContact() {
  sendGTMEvent({ event: 'generate_lead', method: 'whatsapp' });
}
