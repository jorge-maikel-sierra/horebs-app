'use client';

import Panel from '@/components/informes/Panel';
import RankingBarras from '@/components/informes/RankingBarras';
import { plural, type ContextoSeccion } from '@/components/informes/informes.tipos';

export default function SeccionProductos({ informe }: ContextoSeccion) {
  return (
    <div className="mt-4 grid gap-4 @3xl:grid-cols-12">
      <Panel
        className="@3xl:col-span-7"
        titulo="Productos más vendidos"
        subtitulo="Ranking por ingresos en el período"
      >
        <RankingBarras
          numerado
          tono="azul"
          vacio="Sin productos vendidos en este rango."
          filas={informe.top_productos.map((p) => ({
            clave: p.nombre,
            etiqueta: p.nombre,
            valor: p.total,
            detalle: `${plural(p.cantidad, 'unidad', 'unidades')} ${p.cantidad === 1 ? 'vendida' : 'vendidas'}`,
          }))}
        />
      </Panel>
      <Panel className="@3xl:col-span-5" titulo="Ventas por categoría">
        <RankingBarras
          tono="azul"
          vacio="Sin ventas por categoría en este rango."
          filas={informe.por_categoria.map((c) => ({
            clave: c.nombre,
            etiqueta: c.nombre,
            valor: c.total,
            detalle: plural(c.cantidad, 'artículo'),
          }))}
        />
      </Panel>
    </div>
  );
}
