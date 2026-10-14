'use client';

import { useId } from 'react';

export default function Sparkline({
  datos,
  className = '',
}: {
  datos: number[];
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  if (datos.length < 2) return null;

  const max = Math.max(...datos);
  const min = Math.min(...datos);
  const rango = max - min || 1;
  const linea = datos
    .map((v, i) => {
      const x = (i / (datos.length - 1)) * 100;
      const y = 28 - ((v - min) / rango) * 24;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linea} L100 32 L0 32 Z`} fill={`url(#${id})`} />
      <path
        d={linea}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
