'use client';

import { useState } from 'react';
import { formatPrecio } from '@/lib/formato';

// Paleta categórica validada con validate_palette.js (6 slots, claro sobre
// #fff y oscuro sobre zinc-950): CVD ΔE >= 8.4 entre vecinos. En claro tres
// tonos quedan bajo 3:1, por eso la leyenda siempre lleva nombre y valor.
const SERIES = [
  'bg-[#eb6834] dark:bg-[#d95926]',
  'bg-[#2a78d6] dark:bg-[#3987e5]',
  'bg-[#1baf7a] dark:bg-[#199e70]',
  'bg-[#eda100] dark:bg-[#c98500]',
  'bg-[#e87ba4] dark:bg-[#d55181]',
  'bg-[#008300] dark:bg-[#0ca30c]',
];

// "Sin dato" no es una categoría: gris con rayas para que no se lea como
// una serie más, ni siquiera sin color.
const SIN_DATO = 'bg-zinc-400 dark:bg-zinc-600';
const RAYAS = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.28) 0 2px, transparent 2px 6px)',
};

export type SegmentoParticipacion = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** "83 pedidos", "195 artículos". */
  detalle: string;
  /** Posición fija de la entidad en la paleta: el color sigue a la entidad, no al ranking. */
  slot: number;
  sinDato?: boolean;
};

const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export default function BarraParticipacion({
  segmentos,
  vacio = 'Sin ventas en este rango.',
}: {
  segmentos: SegmentoParticipacion[];
  vacio?: string;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const conValor = segmentos.filter((s) => s.valor > 0);
  const enCero = segmentos.filter((s) => s.valor <= 0);
  const total = conValor.reduce((s, x) => s + x.valor, 0);

  if (total === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{vacio}</p>;
  }

  const color = (s: SegmentoParticipacion) =>
    s.sinDato ? SIN_DATO : SERIES[s.slot % SERIES.length];
  const atenuar = (clave: string) =>
    activo !== null && activo !== clave ? 'opacity-35' : '';

  return (
    <div onPointerLeave={() => setActivo(null)}>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={conValor
          .map((s) => `${s.etiqueta} ${PCT.format((s.valor / total) * 100)}%`)
          .join(', ')}
      >
        {conValor.map((s) => (
          <span
            key={s.clave}
            onPointerEnter={() => setActivo(s.clave)}
            className={`h-full min-w-1 transition-opacity ${color(s)} ${atenuar(s.clave)}`}
            style={{ flexGrow: s.valor, flexBasis: 0, ...(s.sinDato ? RAYAS : {}) }}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1">
        {conValor.map((s) => (
          <li
            key={s.clave}
            tabIndex={0}
            onPointerEnter={() => setActivo(s.clave)}
            onFocus={() => setActivo(s.clave)}
            onBlur={() => setActivo(null)}
            className={`-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${atenuar(s.clave)} ${activo === s.clave ? 'bg-zinc-100 dark:bg-zinc-800/60' : ''}`}
          >
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px] ${color(s)}`}
              style={s.sinDato ? RAYAS : undefined}
              aria-hidden="true"
            />
            {/* Nombre y detalle apilados, y monto con su porcentaje debajo:
                antes iban en una sola fila con anchos fijos y el monto se
                salía de la tarjeta en columnas angostas. */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-zinc-700 dark:text-zinc-300">{s.etiqueta}</span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{s.detalle}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block font-semibold text-zinc-900 dark:text-zinc-50">{formatPrecio(s.valor)}</span>
              <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {PCT.format((s.valor / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>

      {enCero.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Sin ventas: {enCero.map((s) => s.etiqueta).join(', ')}
        </p>
      )}
    </div>
  );
}
