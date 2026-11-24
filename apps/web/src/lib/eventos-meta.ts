'use client';

import { leerCookie } from './atribucion';

/**
 * Copia de servidor de los eventos del Pixel (API de conversiones). El mismo
 * id va al dataLayer, donde la etiqueta del Pixel en GTM lo lee como
 * `eventID`: Meta recibe los dos y se queda con uno. Así el evento llega
 * aunque un bloqueador frene el Pixel.
 */

export type EventoMeta = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Contact';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function nuevoIdEvento(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Navegadores viejos sin randomUUID: v4 armado a mano con getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

declare global {
  interface Window {
    __horebsPageViewId?: string;
  }
}

/**
 * Id del PageView de esta carga. Lo comparten el sitio y la variable
 * "JS - PageView event_id" de GTM: el que llegue primero lo crea.
 */
export function idPageView(): string {
  window.__horebsPageViewId ??= nuevoIdEvento();
  return window.__horebsPageViewId;
}

export function enviarEventoMeta(
  evento: EventoMeta,
  eventId: string,
  extra: { value?: number; content_ids?: string[] } = {},
): void {
  try {
    const cuerpo = {
      event_name: evento,
      event_id: eventId,
      url: `${window.location.origin}${window.location.pathname}`,
      fbp: leerCookie('_fbp'),
      fbc: leerCookie('_fbc'),
      ...extra,
    };
    // keepalive: el evento sale aunque el clic cambie de página (WhatsApp).
    fetch(`${API_URL}/eventos-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Es medición: nunca rompe la página.
  }
}
