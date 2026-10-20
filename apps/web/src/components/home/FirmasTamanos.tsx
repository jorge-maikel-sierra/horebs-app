'use client';

import { useId, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrecio } from '@/lib/formato';
import { TAMANOS } from '@/lib/tamanos';
import {
  NOMBRES_TAMANO,
  hrefProducto,
  precioTamano,
  type NombreTamano,
  type ProductoCarta,
} from './productos';

const DIAMETRO_MAX = TAMANOS.Grande.cm;
const BASE = TAMANOS.Personal.cm;

// Ingredientes fijos sobre la pizza dibujada (coordenadas en el viewBox).
const INGREDIENTES = [
  [70, 62],
  [128, 58],
  [150, 98],
  [92, 96],
  [60, 128],
  [118, 132],
  [146, 150],
  [84, 160],
  [110, 82],
] as const;

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

function nombreCorto(nombre: string) {
  return nombre.replace(/^Pizza\s+(Horebs\s+)?/i, '');
}

/** Cuánta pizza es este tamaño comparado con la Personal, por superficie. */
function comparativa(tamano: NombreTamano) {
  if (tamano === 'Personal') return 'La medida para uno o para probar.';
  const veces = (TAMANOS[tamano].cm / BASE) ** 2;
  return `${veces.toLocaleString('es-CO', { maximumFractionDigits: 1 })} veces la pizza de una Personal.`;
}

function PizzaAEscala({ tamano }: { tamano: NombreTamano }) {
  const { cm, porciones } = TAMANOS[tamano];
  const cortes = Array.from({ length: porciones }, (_, i) => (360 / porciones) * i);
  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label={`Pizza ${tamano} de ${cm} cm en ${porciones} porciones`}
      className="w-full max-w-[13rem]"
    >
      {NOMBRES_TAMANO.map((t) => (
        <circle
          key={t}
          cx="110"
          cy="110"
          r={(TAMANOS[t].cm / DIAMETRO_MAX) * 104}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="3 5"
        />
      ))}
      <g className="pizza-escala" style={{ transform: `scale(${cm / DIAMETRO_MAX})` }}>
        <circle cx="110" cy="110" r="104" fill="#c9843f" />
        <circle cx="110" cy="110" r="92" fill="#f4c752" />
        {INGREDIENTES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#b63d24" />
        ))}
        {cortes.map((a) => (
          <line
            key={a}
            x1="110"
            y1="110"
            x2={110 + 104 * Math.cos((a * Math.PI) / 180)}
            y2={110 + 104 * Math.sin((a * Math.PI) / 180)}
            stroke="#7a4a1c"
            strokeWidth="2.5"
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Las dos firmas de la casa con un selector de tamaño: la pizza dibujada
 * crece a su diámetro real y los precios de las dos cambian juntos. Sin JS
 * se ve la Mediana, que es el tamaño marcado por defecto.
 */
export default function FirmasTamanos({ firmas }: { firmas: ProductoCarta[] }) {
  const [tamano, setTamano] = useState<NombreTamano>('Mediana');
  const grupo = useId();
  const { cm, porciones } = TAMANOS[tamano];

  return (
    <section
      id="firmas"
      aria-labelledby="titulo-firmas"
      className="px-[clamp(1.5rem,4.5vw,4.5rem)] pt-[clamp(5rem,10vw,9rem)] pb-[clamp(4rem,8vw,7rem)]"
    >
      <div data-entrada>
        <h2 id="titulo-firmas" style={escalon(0)} className="entra t-titulo text-balance">
          Las dos firmas de la casa
        </h2>
        <p style={escalon(1)} className="entra t-cuerpo mt-5 max-w-[46ch]">
          La Especial y la Hawaiana son las pizzas que definen a Horebs. Elige el tamaño y mira
          cuánto rinde cada una.
        </p>

        <fieldset style={escalon(2)} className="entra mt-10">
          <legend className="t-cuerpo font-semibold">¿De qué tamaño la quieres?</legend>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {NOMBRES_TAMANO.map((t) => (
              <label key={t} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={grupo}
                  value={t}
                  checked={tamano === t}
                  onChange={() => setTamano(t)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col gap-1 bg-[var(--superficie)] px-3 py-4 transition-colors duration-200 peer-checked:bg-brand-navy peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-ink)] hover:bg-[color-mix(in_srgb,var(--superficie)_70%,var(--foreground)_8%)] peer-checked:hover:bg-brand-navy sm:px-4">
                  <span className="t-cuerpo font-semibold">{t}</span>
                  <span className="t-chico">
                    {TAMANOS[t].porciones} porciones
                    <span className="block">{TAMANOS[t].cm} cm</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <figure
          style={escalon(3)}
          className="entra mt-10 grid items-center gap-6 sm:grid-cols-[13rem_1fr] sm:gap-10"
        >
          <PizzaAEscala tamano={tamano} />
          <figcaption className="t-entrada" aria-live="polite">
            <strong className="font-semibold">
              {tamano}: {cm} cm, {porciones} porciones.
            </strong>{' '}
            {comparativa(tamano)}
          </figcaption>
        </figure>
      </div>

      {firmas.map((p, i) => {
        const precio = precioTamano(p, tamano);
        const corto = nombreCorto(p.nombre);
        return (
          <article
            key={p.id}
            data-foto={i + 1}
            data-entrada
            aria-labelledby={`firma-${p.id}`}
            className="mt-[clamp(4rem,8vw,7rem)]"
          >
            {p.imagen_url && (
              <div className="entra relative mb-8 aspect-[4/3] overflow-hidden lg:hidden">
                <Image
                  src={p.imagen_url}
                  alt={`${p.nombre} a domicilio en Riohacha`}
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            )}
            <h3 id={`firma-${p.id}`} style={escalon(0)} className="entra t-titulo">
              {p.nombre}
            </h3>
            {p.descripcion && (
              <p style={escalon(1)} className="entra t-cuerpo mt-4 max-w-[46ch]">
                {p.descripcion}
              </p>
            )}
            <div style={escalon(2)} className="entra mt-7 max-w-xl">
              <p className="t-entrada flex items-baseline">
                <span>
                  {tamano}
                  <span className="t-chico text-tinta-suave"> · {porciones} porciones</span>
                </span>
                <span aria-hidden="true" className="guia" />
                <span className="font-display tabular-nums">
                  {precio !== null ? formatPrecio(precio) : 'No viene en este tamaño'}
                </span>
              </p>
              {precio !== null && (
                <p className="t-chico mt-1 text-right text-tinta-suave">
                  Unos {formatPrecio(Math.round(precio / porciones))} la porción
                </p>
              )}
            </div>
            <div style={escalon(3)} className="entra mt-8">
              <Link href={hrefProducto(p)} className="boton boton-pedir">
                Pedir la {corto}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}
