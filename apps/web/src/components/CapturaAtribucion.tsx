'use client';

import { useEffect } from 'react';
import { capturarAtribucion, marcarEnlaceWhatsapp } from '@/lib/atribucion';
import { enviarEventoMeta, idPageView } from '@/lib/eventos-meta';

// Espera a que el Pixel cree la cookie _fbp para mandarla con el PageView.
const ESPERA_PAGEVIEW_MS = 1500;

/**
 * Guarda fbclid, gclid y UTM del anuncio al entrar al sitio, y al tocar
 * cualquier enlace de WhatsApp le agrega la marca de Google si la visita vino
 * de un anuncio de Google (lo atiende una persona, que lo registra en la caja).
 * También manda la copia de servidor del PageView de esta carga (el Pixel
 * solo cuenta el PageView al cargar la página, no al navegar dentro del sitio).
 * No pinta nada.
 */
export default function CapturaAtribucion() {
  useEffect(() => {
    capturarAtribucion();
    const pageView = window.setTimeout(
      () => enviarEventoMeta('PageView', idPageView()),
      ESPERA_PAGEVIEW_MS,
    );
    // En captura: el href se ajusta antes de que el navegador abra el enlace.
    const alTocar = (e: MouseEvent) => {
      const enlace = (e.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (enlace instanceof HTMLAnchorElement) enlace.href = marcarEnlaceWhatsapp(enlace.href);
    };
    document.addEventListener('click', alTocar, true);
    return () => {
      window.clearTimeout(pageView);
      document.removeEventListener('click', alTocar, true);
    };
  }, []);
  return null;
}
