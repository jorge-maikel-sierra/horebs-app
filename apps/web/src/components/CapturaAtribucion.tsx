'use client';

import { useEffect } from 'react';
import { capturarAtribucion, marcarEnlaceWhatsapp } from '@/lib/atribucion';

/**
 * Guarda fbclid, gclid y UTM del anuncio al entrar al sitio, y al tocar
 * cualquier enlace de WhatsApp le agrega la marca de Google si la visita vino
 * de un anuncio de Google (lo atiende una persona, que lo registra en la caja).
 * No pinta nada.
 */
export default function CapturaAtribucion() {
  useEffect(() => {
    capturarAtribucion();
    // En captura: el href se ajusta antes de que el navegador abra el enlace.
    const alTocar = (e: MouseEvent) => {
      const enlace = (e.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (enlace instanceof HTMLAnchorElement) enlace.href = marcarEnlaceWhatsapp(enlace.href);
    };
    document.addEventListener('click', alTocar, true);
    return () => document.removeEventListener('click', alTocar, true);
  }, []);
  return null;
}
