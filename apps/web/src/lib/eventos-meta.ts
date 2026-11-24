'use client';

import { sendGTMEvent } from '@next/third-parties/google';
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

// Espera a que el Pixel cree la cookie _fbp para mandarla con la copia de servidor.
const ESPERA_PAGEVIEW_MS = 1500;

/**
 * PageView de esta carga. La etiqueta "FB Pixel - PageView" de GTM se activa
 * con el evento `meta_page_view` y lee `event_id` del dataLayer: así el Pixel
 * y el servidor mandan el mismo id. Devuelve la función que cancela el envío.
 */
export function registrarPageView(): () => void {
  const eventId = nuevoIdEvento();
  sendGTMEvent({ event: 'meta_page_view', event_id: eventId });
  const espera = window.setTimeout(() => enviarEventoMeta('PageView', eventId), ESPERA_PAGEVIEW_MS);
  return () => window.clearTimeout(espera);
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
