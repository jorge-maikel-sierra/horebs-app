'use client';

import { formatPrecio } from '@/lib/formato';
import { calcularDelta, etiquetaCorta, etiquetaLarga, etiquetaRango, formatoEjePesos } from '@/lib/informes-rango';
import Destacados from '@/components/informes/Destacados';
import GraficoColumnas from '@/components/informes/GraficoColumnas';
import MezclaVentas from '@/components/informes/MezclaVentas';
import Panel from '@/components/informes/Panel';
import { HeroVentas, TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconArticulos, IconMoneda, IconPedidos, IconTendencia, IconTicket } from '@/components/informes/iconos';
import { plural, type ContextoSeccion, type InformeDia } from '@/components/informes/informes.tipos';

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


export default function SeccionResumen({ informe, anterior, vs, etiqueta }: ContextoSeccion) {
  const r = informe.resumen;
  const ra = anterior?.resumen;
  const mejorDia = informe.serie_diaria.reduce<InformeDia | null>(
    (mejor, d) => (!mejor || d.total > mejor.total ? d : mejor),
    null,
  );

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
      </div>

      {/* Escritorio: gráfico (8/12) con "Lo destacado" al lado (4/12).
          Más angosto: el gráfico a lo ancho y lo destacado debajo, en 2×2. */}
      <div className="mt-4 grid gap-4 @4xl:grid-cols-12">
        <Panel
          className="@4xl:col-span-8"
          titulo="Ventas por día"
          subtitulo={etiquetaRango(informe.desde, informe.hasta)}
        >
          <GraficoVentasDiarias datos={informe.serie_diaria} />
        </Panel>
        <div className="@4xl:col-span-4">
          <Destacados informe={informe} />
        </div>
      </div>

      <div className="mt-4">
        <MezclaVentas informe={informe} />
      </div>
    </>
  );
}
