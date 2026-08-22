'use client';

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/analytics';

type Variante = {
  id: string;
  nombre: string;
  precio: number;
  precio_oferta: number | null;
};

/** Sin render — solo dispara view_item una vez al montar la página de producto. */
export default function TrackViewItem({
  nombre,
  variantes,
}: {
  nombre: string;
  variantes: Variante[];
}) {
  useEffect(() => {
    trackViewItem({ nombre, variantes });
    // Se dispara una sola vez al montar la página de producto — no debe
    // repetirse si el usuario interactúa y algo cambia estas props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
