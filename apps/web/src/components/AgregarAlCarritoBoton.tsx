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
      className={`btn-press shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white transition-colors duration-300 hover:opacity-90 ${
        agregado ? 'bg-green-600' : 'bg-brand-orange'
      }`}
    >
      <span key={agregado ? 'on' : 'off'} className="animate-pop-in inline-block">
        {agregado ? 'Agregado ✓' : 'Agregar'}
      </span>
    </button>
  );
}
