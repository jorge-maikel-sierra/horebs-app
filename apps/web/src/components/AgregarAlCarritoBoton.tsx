'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';

type Props = {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  precio: number;
};

export default function AgregarAlCarritoBoton({
  varianteId,
  productoNombre,
  varianteNombre,
  precio,
}: Props) {
  const { addItem } = useCart();
  const [agregado, setAgregado] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addItem({ varianteId, productoNombre, varianteNombre, precio });
        setAgregado(true);
        setTimeout(() => setAgregado(false), 1200);
      }}
      className="shrink-0 rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-semibold text-white transition hover:opacity-90"
    >
      {agregado ? 'Agregado ✓' : 'Agregar'}
    </button>
  );
}
