'use client';

import { sendGTMEvent } from '@next/third-parties/google';
import posthog from 'posthog-js';

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

/**
 * Empuja el evento de ecommerce al dataLayer de GTM y el mismo evento, con los
 * mismos nombres de GA4, a PostHog (si está iniciado en `instrumentation-client.ts`).
 */
function medirEcommerce(event: string, ecommerce: Record<string, unknown>) {
  limpiarEcommerceAnterior();
  sendGTMEvent({ event, ecommerce });
  if (posthog.__loaded) posthog.capture(event, ecommerce);
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
 * Único punto de entrada de medición del sitio: cada evento va al dataLayer
 * de GTM y a PostHog. El Pixel de Facebook, GA4 y Google Ads se configuran
 * como tags DENTRO de GTM (leyendo estos mismos eventos), no acá; PostHog
 * se inicia una sola vez en `instrumentation-client.ts`.
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

  medirEcommerce('view_item', { currency: MONEDA, value, items });
}

export function trackAddToCart(item: ItemCarrito, cantidad: number) {
  const ga4Item = itemAGA4(item, cantidad);
  const value = item.precio * cantidad;

  medirEcommerce('add_to_cart', { currency: MONEDA, value, items: [ga4Item] });
}

export function trackBeginCheckout(items: (ItemCarrito & { cantidad: number })[], value: number) {
  if (items.length === 0) return;

  const ga4Items = items.map((i) => itemAGA4(i, i.cantidad));

  medirEcommerce('begin_checkout', { currency: MONEDA, value, items: ga4Items });
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

  medirEcommerce('purchase', {
    transaction_id: pedido.id,
    currency: MONEDA,
    value: pedido.total,
    shipping: pedido.costoDomicilio,
    items: ga4Items,
  });
}

/**
 * Pasos dentro del checkout, solo para PostHog (embudo de compra). Nunca
 * llevan datos personales: el campo que falló, no lo que la persona escribió.
 */
function medirCheckout(event: string, propiedades: Record<string, unknown>) {
  if (posthog.__loaded) posthog.capture(event, propiedades);
}

export type CampoCheckout = 'nombre' | 'apellido' | 'telefono' | 'correo' | 'direccion';

export function trackMetodoPagoElegido(metodo: string) {
  medirCheckout('checkout_payment_method_selected', { payment_method: metodo });
}

export function trackModalidadElegida(modalidad: string) {
  medirCheckout('checkout_delivery_mode_selected', { delivery_mode: modalidad });
}

export function trackErrorValidacionCheckout(campo: CampoCheckout) {
  medirCheckout('checkout_validation_error', { field: campo });
}

export function trackPedidoEnviado(datos: {
  metodoPago: string;
  modalidad: string;
  value: number;
  items: number;
  usaPuntos: boolean;
  conSesion: boolean;
}) {
  medirCheckout('checkout_order_submitted', {
    payment_method: datos.metodoPago,
    delivery_mode: datos.modalidad,
    currency: MONEDA,
    value: datos.value,
    items_count: datos.items,
    uses_points: datos.usaPuntos,
    logged_in: datos.conSesion,
  });
}

/** El API rechazó el pedido: `status` HTTP y el texto que vio el cliente (no tiene datos personales). */
export function trackErrorPedido(status: number | null, mensaje: string) {
  medirCheckout('checkout_order_failed', { status, error_message: mensaje });
}

/** WhatsApp es el canal de contacto principal del sitio — se trackea como lead. */
export function trackContact() {
  sendGTMEvent({ event: 'generate_lead', method: 'whatsapp' });
  if (posthog.__loaded) posthog.capture('generate_lead', { method: 'whatsapp' });
}
