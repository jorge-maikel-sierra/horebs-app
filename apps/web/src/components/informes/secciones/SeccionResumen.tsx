'use client';

import { formatPrecio } from '@/lib/formato';
import { calcularDelta, etiquetaCorta, etiquetaLarga, etiquetaRango, formatoEjePesos } from '@/lib/informes-rango';
import { ORIGEN_LABEL } from '@/lib/origen-venta';
import GraficoColumnas from '@/components/informes/GraficoColumnas';
import Panel from '@/components/informes/Panel';
import RankingBarras from '@/components/informes/RankingBarras';
import { HeroVentas, TarjetaKpi, TiraDomicilio } from '@/components/informes/TarjetasResumen';
import { IconArticulos, IconMoneda, IconMoto, IconPedidos, IconTendencia, IconTicket } from '@/components/informes/iconos';
import {
  CANAL_LABEL,
  METODO_PAGO_LABEL,
  MODALIDAD_LABEL,
  plural,
  type ContextoSeccion,
  type InformeDesglose,
  type InformeDia,
} from '@/components/informes/informes.tipos';

function formatDiaCorto(fechaISO: string) {
  if (fechaISO.length === 7) {
    return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })
      .format(new Date(`${fechaISO}-01T00:00:00`))
      .replace('.', '');
  }
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })
    .format(new Date(`${fechaISO}T00:00:00`))
    .replace('.', '');
}

export function GraficoVentasDiarias({ datos }: { datos: InformeDia[] }) {
  return (
    <GraficoColumnas
      tono="naranja"
      nombreValor="Ventas"
      nombreDetalle="Pedidos"
      puntos={datos.map((d) => ({
        clave: d.fecha,
        etiqueta: etiquetaCorta(d.fecha),
        etiquetaLarga: etiquetaLarga(d.fecha),
        valor: d.total,
        detalle: plural(d.pedidos, 'pedido'),
        valorDetalle: String(d.pedidos),
      }))}
      formatoValor={formatPrecio}
      formatoEje={formatoEjePesos}
    />
  );
}

function filasDesglose(items: InformeDesglose[], etiquetas: Record<string, string>) {
  const totalGeneral = items.reduce((s, i) => s + i.total, 0) || 1;
  return items.map((i) => ({
    clave: i.clave,
    etiqueta: etiquetas[i.clave] ?? i.clave,
    valor: i.total,
    detalle: `${Math.round((i.total / totalGeneral) * 100)}% · ${plural(i.pedidos, 'pedido')}`,
  }));
}

export default function SeccionResumen({ informe, anterior, vs, etiqueta }: ContextoSeccion) {
  const r = informe.resumen;
  const ra = anterior?.resumen;
  const mejorDia = informe.serie_diaria.reduce<InformeDia | null>(
    (mejor, d) => (!mejor || d.total > mejor.total ? d : mejor),
    null,
  );
  const desgloses = [
    { titulo: 'Método de pago', items: informe.por_metodo_pago, etiquetas: METODO_PAGO_LABEL },
    { titulo: 'Modalidad', items: informe.por_modalidad, etiquetas: MODALIDAD_LABEL },
    { titulo: 'Canal de venta', items: informe.por_canal, etiquetas: CANAL_LABEL },
    {
      titulo: 'Origen de la venta',
      subtitulo: 'De dónde llegó el pedido; la caja lo registra desde el 17 nov',
      items: informe.por_origen,
      etiquetas: ORIGEN_LABEL,
    },
  ];

  return (
    <>
      {/* Teléfono: hero y KPIs 2×2. Tablet: hero a lo ancho y 4 KPIs en fila.
          Escritorio: hero a la izquierda (5/12) y KPIs 2×2 a la derecha. */}
      <div className="animate-fade-up mt-5 grid gap-3 @2xl:gap-4 @4xl:grid-cols-12">
        <div className="@4xl:col-span-5">
          <HeroVentas
            icono={<IconMoneda />}
            valor={formatPrecio(r.ventas_brutas)}
            periodo={etiqueta}
            delta={calcularDelta(r.ventas_brutas, ra?.ventas_brutas)}
            vs={vs}
            serie={informe.serie_diaria.map((d) => d.total)}
            mejorDia={
              mejorDia && informe.serie_diaria.length > 1
                ? `${formatDiaCorto(mejorDia.fecha)} · ${formatPrecio(mejorDia.total)}`
                : undefined
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4 @2xl:gap-4 @4xl:col-span-7 @4xl:grid-cols-2">
          <TarjetaKpi
            tono="azul"
            icono={<IconPedidos />}
            label="Pedidos"
            valor={String(r.pedidos)}
            delta={calcularDelta(r.pedidos, ra?.pedidos)}
            vs={vs}
            serie={informe.serie_diaria.map((d) => d.pedidos)}
          />
          <TarjetaKpi
            tono="amarillo"
            icono={<IconTicket />}
            label="Ticket promedio"
            valor={formatPrecio(r.ticket_promedio)}
            delta={calcularDelta(r.ticket_promedio, ra?.ticket_promedio)}
            vs={vs}
            serie={informe.serie_diaria.map((d) => (d.pedidos ? d.total / d.pedidos : 0))}
          />
          <TarjetaKpi
            tono="verde"
            icono={<IconArticulos />}
            label="Artículos vendidos"
            valor={String(r.articulos_vendidos)}
            delta={calcularDelta(r.articulos_vendidos, ra?.articulos_vendidos)}
            vs={vs}
          />
          <TarjetaKpi
            tono="naranja"
            icono={<IconTendencia />}
            label="Promedio diario"
            valor={formatPrecio(r.promedio_diario)}
            delta={calcularDelta(r.promedio_diario, ra?.promedio_diario)}
            vs={vs}
          />
        </div>
        <div className="@4xl:col-span-12">
          <TiraDomicilio
            icono={<IconMoto />}
            valor={formatPrecio(r.costo_domicilio_total)}
            porcentaje={r.ventas_brutas > 0 ? (r.costo_domicilio_total / r.ventas_brutas) * 100 : 0}
          />
        </div>
      </div>

      <div className="mt-4">
        <Panel titulo="Ventas por día" subtitulo={etiquetaRango(informe.desde, informe.hasta)}>
          <GraficoVentasDiarias datos={informe.serie_diaria} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-4">
        {desgloses.map((d) => (
          <Panel key={d.titulo} titulo={d.titulo} subtitulo={d.subtitulo}>
            <RankingBarras
              tono="naranja"
              filas={filasDesglose(d.items, d.etiquetas)}
              vacio="Sin datos en este rango."
            />
          </Panel>
        ))}
      </div>
    </>
  );
}
