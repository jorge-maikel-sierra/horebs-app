'use client';

import { useState } from 'react';
import { ORIGEN_LABEL } from '@/lib/origen-venta';
import BarraParticipacion, { type SegmentoParticipacion } from '@/components/informes/BarraParticipacion';
import {
  CANAL_LABEL,
  METODO_PAGO_LABEL,
  MODALIDAD_LABEL,
  plural,
  type InformeDesglose,
  type InformeDto,
} from '@/components/informes/informes.tipos';

const SIN_ORIGEN = 'caja_sin_origen';
const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

type Dimension = {
  clave: string;
  corto: string;
  titulo: string;
  items: InformeDesglose[];
  etiquetas: Record<string, string>;
};

function segmentos(d: Dimension): SegmentoParticipacion[] {
  // El slot sale del orden fijo del diccionario de etiquetas: así "WhatsApp"
  // tiene el mismo color en cualquier período, aunque cambie de puesto.
  const orden = Object.keys(d.etiquetas).filter((k) => k !== SIN_ORIGEN);
  return d.items.map((i) => {
    const pos = orden.indexOf(i.clave);
    return {
      clave: i.clave,
      etiqueta: d.etiquetas[i.clave] ?? i.clave,
      valor: i.total,
      detalle: plural(i.pedidos, 'pedido'),
      slot: pos === -1 ? orden.length : pos,
      sinDato: i.clave === SIN_ORIGEN,
    };
  });
}

function AvisoSinOrigen({ items }: { items: InformeDesglose[] }) {
  const total = items.reduce((s, i) => s + i.total, 0);
  const sin = items.find((i) => i.clave === SIN_ORIGEN)?.total ?? 0;
  if (!total || !sin) return null;
  return (
    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
      <strong className="font-semibold">{PCT.format((sin / total) * 100)}% sin origen registrado.</strong>{' '}
      La caja pregunta de dónde llegó el pedido desde el 17 nov; los anteriores quedan así.
    </p>
  );
}

export default function MezclaVentas({ informe }: { informe: InformeDto }) {
  const dimensiones: Dimension[] = [
    { clave: 'pago', corto: 'Pago', titulo: 'Método de pago', items: informe.por_metodo_pago, etiquetas: METODO_PAGO_LABEL },
    { clave: 'modalidad', corto: 'Modalidad', titulo: 'Modalidad', items: informe.por_modalidad, etiquetas: MODALIDAD_LABEL },
    { clave: 'canal', corto: 'Canal', titulo: 'Canal de venta', items: informe.por_canal, etiquetas: CANAL_LABEL },
    { clave: 'origen', corto: 'Origen', titulo: 'Origen del pedido', items: informe.por_origen, etiquetas: ORIGEN_LABEL },
  ];
  const [activa, setActiva] = useState('pago');

  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Mezcla de ventas</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Cómo se reparten las ventas del período
          </p>
        </div>
        {/* En teléfono una dimensión a la vez; desde tablet se ven las cuatro. */}
        <div
          role="tablist"
          aria-label="Dimensión"
          className="flex w-full rounded-xl bg-zinc-100 p-1 @2xl:hidden dark:bg-zinc-800/70"
        >
          {dimensiones.map((d) => (
            <button
              key={d.clave}
              type="button"
              role="tab"
              aria-selected={activa === d.clave}
              onClick={() => setActiva(d.clave)}
              className={`h-9 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                activa === d.clave
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {d.corto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-6 @2xl:grid-cols-2 @6xl:grid-cols-4">
        {dimensiones.map((d) => (
          <div key={d.clave} className={activa === d.clave ? '' : 'hidden @2xl:block'}>
            <h3 className="mb-2.5 hidden text-xs font-semibold tracking-wider text-zinc-500 uppercase @2xl:block dark:text-zinc-400">
              {d.titulo}
            </h3>
            <BarraParticipacion segmentos={segmentos(d)} />
            {d.clave === 'origen' && <AvisoSinOrigen items={d.items} />}
          </div>
        ))}
      </div>
    </section>
  );
}
