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
 * Wrapper de fbq — el Pixel de Facebook puede no estar configurado
 * (falta NEXT_PUBLIC_FACEBOOK_PIXEL_ID) o su script todavía no cargó;
 * en ambos casos esto no debe romper el resto del tracking.
 */
function fbq(...args: unknown[]) {
  const w = window as typeof window & { fbq?: (...a: unknown[]) => void };
  w.fbq?.(...args);
}

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
  fbq('track', 'ViewContent', {
    content_ids: items.map((i) => i.item_id),
    content_name: producto.nombre,
    content_type: 'product',
    value,
    currency: MONEDA,
  });
}

export function trackAddToCart(item: ItemCarrito, cantidad: number) {
  const ga4Item = itemAGA4(item, cantidad);
  const value = item.precio * cantidad;

  limpiarEcommerceAnterior();
  sendGTMEvent({
    event: 'add_to_cart',
    ecommerce: { currency: MONEDA, value, items: [ga4Item] },
  });
  fbq('track', 'AddToCart', {
    content_ids: [item.varianteId],
    content_name: item.productoNombre,
    content_type: 'product',
    value,
    currency: MONEDA,
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
  fbq('track', 'InitiateCheckout', {
    content_ids: items.map((i) => i.varianteId),
    contents: items.map((i) => ({ id: i.varianteId, quantity: i.cantidad })),
    num_items: items.reduce((acc, i) => acc + i.cantidad, 0),
    value,
    currency: MONEDA,
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
  fbq('track', 'Purchase', {
    content_ids: ga4Items.map((i) => i.item_id),
    contents: ga4Items.map((i) => ({ id: i.item_id, quantity: i.quantity })),
    value: pedido.total,
    currency: MONEDA,
  });
}

/** WhatsApp es el canal de contacto principal del sitio — se trackea como lead. */
export function trackContact() {
  sendGTMEvent({ event: 'generate_lead', method: 'whatsapp' });
  fbq('track', 'Contact');
}
