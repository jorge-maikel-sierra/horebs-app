'use client';

import { useEffect } from 'react';
import { capturarAtribucion } from '@/lib/atribucion';

/** Guarda fbclid y UTM del anuncio al entrar al sitio. No pinta nada. */
export default function CapturaAtribucion() {
  useEffect(() => {
    capturarAtribucion();
  }, []);
  return null;
}
