'use client';

import { useState } from 'react';
import BarraParticipacion, { type SegmentoParticipacion } from '@/components/informes/BarraParticipacion';
import Panel from '@/components/informes/Panel';
import RankingBarras from '@/components/informes/RankingBarras';
import { formatPrecio } from '@/lib/formato';
import { plural, type ContextoSeccion, type InformeCategoria, type InformeProducto } from '@/components/informes/informes.tipos';

type Orden = 'ingresos' | 'unidades';

const ORDENES: { key: Orden; label: string }[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'unidades', label: 'Unidades' },
];

function unidades(p: InformeProducto) {
  return `${plural(p.cantidad, 'unidad', 'unidades')} ${p.cantidad === 1 ? 'vendida' : 'vendidas'}`;
}

/** La paleta validada tiene 6 colores: de la 6.ª categoría en adelante van juntas. */
const MAX_CATEGORIAS = 6;

function segmentosCategorias(categorias: InformeCategoria[]): SegmentoParticipacion[] {
  const ordenadas = [...categorias].sort((a, b) => b.total - a.total);
  const propias = ordenadas.slice(0, MAX_CATEGORIAS - 1);
  const resto = ordenadas.slice(MAX_CATEGORIAS - 1);
  const visibles = resto.length > 1 ? propias : ordenadas;
  // El color sale del nombre en orden alfabético, no del puesto: así
  // "Bebidas" conserva su color aunque suba o baje en el ranking.
  const nombres = visibles.map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es'));
  const segmentos: SegmentoParticipacion[] = visibles.map((c) => ({
    clave: c.nombre,
    etiqueta: c.nombre,
    valor: c.total,
    detalle: plural(c.cantidad, 'artículo'),
    slot: nombres.indexOf(c.nombre),
  }));
  if (resto.length > 1) {
    segmentos.push({
      clave: '__otras',
      etiqueta: `Otras (${resto.length})`,
      valor: resto.reduce((s, c) => s + c.total, 0),
      detalle: plural(resto.reduce((s, c) => s + c.cantidad, 0), 'artículo'),
      slot: 0,
      sinDato: true,
    });
  }
  return segmentos;
}

export default function SeccionProductos({ informe }: ContextoSeccion) {
  const [orden, setOrden] = useState<Orden>('ingresos');
  const porUnidades = orden === 'unidades';
  const productos = [...informe.top_productos].sort((a, b) =>
    porUnidades ? b.cantidad - a.cantidad : b.total - a.total,
  );

  const selector = (
    <div role="radiogroup" aria-label="Ordenar productos por" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70">
      {ORDENES.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={orden === o.key}
          onClick={() => setOrden(o.key)}
          className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
            orden === o.key
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-up mt-5 grid items-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-12">
      <Panel
        className="@4xl:col-span-7"
        titulo="Productos más vendidos"
        subtitulo={
          porUnidades
            ? `Los ${productos.length} de más ingresos, ordenados por unidades`
            : 'Ranking por ingresos en el período'
        }
        accion={selector}
      >
        <RankingBarras
          numerado
          tono="azul"
          vacio="Sin productos vendidos en este rango."
          formato={porUnidades ? (n) => plural(n, 'und.', 'und.') : formatPrecio}
          filas={productos.map((p) => ({
            clave: p.nombre,
            etiqueta: p.nombre,
            valor: porUnidades ? p.cantidad : p.total,
            detalle: porUnidades ? formatPrecio(p.total) : unidades(p),
          }))}
        />
      </Panel>
      <Panel className="@4xl:col-span-5" titulo="Ventas por categoría" subtitulo="Participación en las ventas del período">
        <BarraParticipacion
          vacio="Sin ventas por categoría en este rango."
          segmentos={segmentosCategorias(informe.por_categoria)}
        />
      </Panel>
    </div>
  );
}
