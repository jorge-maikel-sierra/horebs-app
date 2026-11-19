import { IconPedidos } from '@/components/admin-iconos';
import { HeroVentas, TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { formatPrecio } from '@/lib/formato';
import EtiquetaPanel from './EtiquetaPanel';
import { IconArticulos, IconMoneda, IconTicket } from './iconos';
import TarjetaTurno from './TarjetaTurno';

/** Subconjunto del DTO de `GET /informes` que usa el panel. */
export type InformeResumen = {
  resumen: {
    ventas_brutas: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
  };
  serie_diaria: { fecha: string; total: number; pedidos: number }[];
};

export type EstadoTurno = {
  cargando: boolean;
  fallo: boolean;
  abiertoEn: string | null;
  totalVentas: number;
};

/**
 * Bloque "Hoy" del panel: ventas del día con sus KPI (solo con informes) y
 * el estado del turno de caja (solo con el punto de venta).
 */
export default function SeccionHoy({
  verInformes,
  verCaja,
  cargandoHoy,
  informeHoy,
  informeAyer,
  informe7,
  turno,
}: {
  verInformes: boolean;
  verCaja: boolean;
  cargandoHoy: boolean;
  informeHoy: InformeResumen | null;
  informeAyer: InformeResumen | null;
  informe7: InformeResumen | null;
  turno: EstadoTurno;
}) {
  const serie7 = informe7?.serie_diaria ?? [];
  return (
    <section
      aria-labelledby="panel-hoy"
      className="animate-fade-up delay-2"
    >
      <EtiquetaPanel id="panel-hoy">Hoy</EtiquetaPanel>
      {verInformes ? (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="col-span-2 lg:row-span-2">
            {cargandoHoy ? (
              <div className="skeleton h-full min-h-56 w-full rounded-3xl" />
            ) : informeHoy ? (
              <HeroVentas
                icono={<IconMoneda />}
                valor={formatPrecio(informeHoy.resumen.ventas_brutas)}
                periodo="Ventas brutas de hoy"
                delta={null}
                vs=""
                serie={serie7.map((d) => d.total)}
                etiquetaNota="Ayer"
                mejorDia={
                  informeAyer
                    ? formatPrecio(informeAyer.resumen.ventas_brutas)
                    : undefined
                }
              />
            ) : (
              <p
                role="alert"
                className="flex h-full min-h-56 items-center justify-center rounded-3xl border border-zinc-200 p-6 text-center text-sm text-red-600 dark:border-zinc-800 dark:text-red-400"
              >
                No se pudieron cargar las ventas de hoy.
              </p>
            )}
          </div>

          {/* Reserva el lugar de las KPI mientras cargan: sin esto la
              tarjeta del turno salta de casilla al llegar los datos. */}
          {cargandoHoy &&
            Array.from({ length: verCaja ? 3 : 4 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="skeleton min-h-36 rounded-2xl"
              />
            ))}
          {informeHoy && (
            <>
              <TarjetaKpi
                icono={<IconPedidos tamano={20} />}
                label="Pedidos"
                valor={String(informeHoy.resumen.pedidos)}
                detalle={
                  informeAyer
                    ? `Ayer: ${informeAyer.resumen.pedidos}`
                    : undefined
                }
                tono="azul"
                serie={serie7.map((d) => d.pedidos)}
              />
              <TarjetaKpi
                icono={<IconTicket />}
                label="Ticket promedio"
                valor={formatPrecio(informeHoy.resumen.ticket_promedio)}
                detalle={
                  informeAyer
                    ? `Ayer: ${formatPrecio(informeAyer.resumen.ticket_promedio)}`
                    : undefined
                }
                tono="amarillo"
                serie={serie7.map((d) =>
                  d.pedidos ? d.total / d.pedidos : 0,
                )}
              />
              <TarjetaKpi
                icono={<IconArticulos />}
                label="Artículos vendidos"
                valor={String(informeHoy.resumen.articulos_vendidos)}
                detalle={
                  informeAyer
                    ? `Ayer: ${informeAyer.resumen.articulos_vendidos}`
                    : undefined
                }
                tono="verde"
              />
            </>
          )}
          {verCaja ? (
            <TarjetaTurno
              cargando={turno.cargando}
              fallo={turno.fallo}
              abiertoEn={turno.abiertoEn}
              totalVentas={turno.totalVentas}
            />
          ) : (
            informeHoy && (
              <TarjetaKpi
                icono={<IconMoneda />}
                label="Ventas 7 días"
                valor={formatPrecio(
                  informe7?.resumen.ventas_brutas ?? 0,
                )}
                detalle={`${informe7?.resumen.pedidos ?? 0} pedidos`}
              />
            )
          )}
        </div>
      ) : (
        <div className="mt-3 max-w-sm">
          <TarjetaTurno
            cargando={turno.cargando}
            fallo={turno.fallo}
            abiertoEn={turno.abiertoEn}
            totalVentas={turno.totalVentas}
          />
        </div>
      )}
    </section>
  );
}
