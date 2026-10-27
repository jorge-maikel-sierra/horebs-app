'use client';

import { useState } from 'react';
import { IconPedidos } from '@/components/admin-iconos';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import GraficoColumnas from '@/components/informes/GraficoColumnas';
import { HeroVentas, TarjetaKpi } from '@/components/informes/TarjetasResumen';
import AccesosModulos from '@/components/panel/AccesosModulos';
import CajaTurno from '@/components/panel/CajaTurno';
import EncabezadoPanel from '@/components/panel/EncabezadoPanel';
import {
  IconAlerta,
  IconArticulos,
  IconCheck,
  IconMoneda,
  IconTicket,
  IconWhatsapp,
} from '@/components/panel/iconos';
import SeccionPanel from '@/components/panel/SeccionPanel';
import TarjetaAtencion from '@/components/panel/TarjetaAtencion';
import TarjetaTurno from '@/components/panel/TarjetaTurno';
import { formatPrecio, type UnidadMedida } from '@/lib/formato';
import {
  etiquetaCorta,
  etiquetaLarga,
  formatoEjePesos,
} from '@/lib/informes-rango';
import type { ModuloId } from '@/lib/modulos';
import { hoyBogota, sumarDias } from '@/lib/semana';
import { useCarga } from '@/lib/use-carga';
import { useModulos } from '@/lib/use-modulos';
import { useRol } from '@/lib/use-rol';

// ---- Tipos (subconjuntos de los DTOs reales del backend) ----

type TurnoActualDto = {
  turno: {
    id: string;
    abierto_en: string;
    estado: 'abierto' | 'cerrado';
  } | null;
  resumen: {
    total_efectivo: number;
    total_transferencia: number;
    total_tarjeta: number;
    total_ventas: number;
    cantidad_ventas: number;
  } | null;
};

type PedidoActivo = { id: string; estado: string };
type InsumoBajo = {
  id: string;
  nombre: string;
  unidad_medida: UnidadMedida;
  stock_actual_g: number;
  stock_minimo_g: number;
};
type ConversacionBot = { id: string; estado: 'bot' | 'derivado' };

type InformeResumen = {
  resumen: {
    ventas_brutas: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
  };
  serie_diaria: { fecha: string; total: number; pedidos: number }[];
};

type TableroFila = {
  empleado: { nombre: string };
  semana: { neto_pagar: number; estado: 'en_curso' | 'liquidada' };
};

const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  pendiente: 'pendiente',
  confirmado: 'confirmado',
  en_preparacion: 'en preparación',
  en_camino: 'en camino',
};

const COLUMNAS_ATENCION: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
      {children}
    </h2>
  );
}

export default function AdminPage() {
  const { rol } = useRol();
  const { cargando: cargandoModulos, activo } = useModulos();
  const esAdmin = rol === 'admin';
  const [hoy] = useState(hoyBogota);
  const ver = (id: ModuloId) => !cargandoModulos && activo(id);

  const verInformes = esAdmin && ver('informes');
  const verNomina = esAdmin && ver('nomina');
  const verCaja = ver('pos');

  // Un módulo apagado (o un rol sin permiso) pasa `null` y no consulta nada.
  const turno = useCarga<TurnoActualDto>(verCaja ? '/turnos/actual' : null);
  const pedidos = useCarga<PedidoActivo[]>(
    ver('pedidos') ? '/admin/pedidos' : null,
  );
  const insumos = useCarga<InsumoBajo[]>(
    ver('inventario') ? '/inventario/insumos?stockBajo=true' : null,
  );
  const conversaciones = useCarga<ConversacionBot[]>(
    ver('seguimiento') ? '/admin/seguimiento/conversaciones' : null,
  );
  const ventasHoy = useCarga<InformeResumen>(
    verInformes ? `/informes?desde=${hoy}&hasta=${hoy}` : null,
  );
  const ventasAyer = useCarga<InformeResumen>(
    verInformes
      ? `/informes?desde=${sumarDias(hoy, -1)}&hasta=${sumarDias(hoy, -1)}`
      : null,
  );
  const ventas7 = useCarga<InformeResumen>(
    verInformes ? `/informes?desde=${sumarDias(hoy, -6)}&hasta=${hoy}` : null,
  );
  const nomina = useCarga<TableroFila[]>(verNomina ? '/nomina/tablero' : null);

  // ---- Atención requerida ----
  const activos = pedidos.datos?.filter(
    (p) => p.estado !== 'entregado' && p.estado !== 'cancelado',
  );
  const detallePedidos = pedidos.fallo
    ? 'No se pudo cargar'
    : activos && activos.length > 0
      ? Object.entries(
          activos.reduce<Record<string, number>>((acc, p) => {
            acc[p.estado] = (acc[p.estado] ?? 0) + 1;
            return acc;
          }, {}),
        )
          .map(([estado, n]) => `${n} ${ESTADO_PEDIDO_LABEL[estado] ?? estado}`)
          .join(' · ')
      : 'Sin pedidos activos';

  const bajos = insumos.datos;
  const detalleStock = insumos.fallo
    ? 'No se pudo cargar'
    : bajos && bajos.length > 0
      ? bajos
          .slice(0, 2)
          .map((i) => i.nombre)
          .join(', ') + (bajos.length > 2 ? ` +${bajos.length - 2} más` : '')
      : 'Todo en orden';

  const esperando = conversaciones.datos?.filter(
    (c) => c.estado === 'derivado',
  );
  const tarjetasAtencion = [
    ver('pedidos') && (
      <TarjetaAtencion
        key="pedidos"
        icono={<IconPedidos tamano={22} />}
        etiqueta="Pedidos activos"
        valor={activos?.length ?? null}
        detalle={detallePedidos}
        href="/admin/pedidos"
        urgente={(activos?.length ?? 0) > 0}
        cargando={pedidos.cargando}
      />
    ),
    ver('inventario') && (
      <TarjetaAtencion
        key="stock"
        icono={<IconAlerta />}
        etiqueta="Stock bajo"
        valor={bajos?.length ?? null}
        detalle={detalleStock}
        href="/admin/inventario"
        urgente={(bajos?.length ?? 0) > 0}
        cargando={insumos.cargando}
      />
    ),
    ver('seguimiento') && (
      <TarjetaAtencion
        key="whatsapp"
        icono={<IconWhatsapp />}
        etiqueta="WhatsApp esperando"
        valor={esperando?.length ?? null}
        detalle={
          conversaciones.fallo
            ? 'No se pudo cargar'
            : 'Conversaciones derivadas a una persona'
        }
        href="/admin/seguimiento"
        urgente={(esperando?.length ?? 0) > 0}
        cargando={conversaciones.cargando}
      />
    ),
  ].filter(Boolean);

  // ---- Hoy ----
  const informeHoy = ventasHoy.datos;
  const informeAyer = ventasAyer.datos;
  const serie7 = ventas7.datos?.serie_diaria ?? [];
  const turnoAbierto = turno.datos?.turno ?? null;
  const resumenTurno = turno.datos?.resumen;

  // ---- Nómina ----
  const enCurso =
    nomina.datos?.filter((f) => f.semana.estado === 'en_curso') ?? [];
  const pendiente = enCurso.reduce((s, f) => s + f.semana.neto_pagar, 0);
  const liquidadas =
    nomina.datos?.filter((f) => f.semana.estado === 'liquidada').length ?? 0;

  const hayVentas = verInformes;
  const hayDerecha = verCaja || verNomina;

  const panelCaja = verCaja && (
    <SeccionPanel
      titulo="Caja del turno"
      subtitulo="Reparto por método de pago"
      enlace={{ href: '/admin/pos', texto: 'Punto de venta' }}
    >
      {turno.cargando ? (
        <CargandoSkeleton filas={2} />
      ) : turno.fallo ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudo cargar el turno.
        </p>
      ) : !turnoAbierto ? (
        <p className="rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
          No hay un turno abierto. Al abrirlo desde el punto de venta verás aquí
          cómo se reparte lo cobrado.
        </p>
      ) : (
        <CajaTurno
          montos={{
            efectivo: resumenTurno?.total_efectivo ?? 0,
            transferencia: resumenTurno?.total_transferencia ?? 0,
            tarjeta: resumenTurno?.total_tarjeta ?? 0,
          }}
        />
      )}
    </SeccionPanel>
  );

  const panelNomina = verNomina && (
    <SeccionPanel
      titulo="Nómina de la semana"
      enlace={{ href: '/admin/nomina', texto: 'Ver nómina' }}
    >
      {nomina.cargando ? (
        <CargandoSkeleton filas={1} />
      ) : !nomina.datos || nomina.datos.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {nomina.fallo
            ? 'No se pudo cargar la nómina.'
            : 'No hay trabajadores activos registrados.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
            <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Por pagar
            </p>
            <p className="mt-1 [overflow-wrap:anywhere] text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatPrecio(pendiente)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {enCurso.length} en curso
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/70">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              <IconCheck /> Liquidadas
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {liquidadas}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              esta semana
            </p>
          </div>
        </div>
      )}
    </SeccionPanel>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <EncabezadoPanel rol={rol} />

      {cargandoModulos ? (
        <CargandoSkeleton filas={4} />
      ) : (
        <div className="mt-8 space-y-8">
          {tarjetasAtencion.length > 0 && (
            <section className="animate-fade-up delay-1">
              <Etiqueta>Atención requerida</Etiqueta>
              <div
                className={`mt-3 grid gap-4 ${COLUMNAS_ATENCION[tarjetasAtencion.length]}`}
              >
                {tarjetasAtencion}
              </div>
            </section>
          )}

          {(verInformes || verCaja) && (
            <section className="animate-fade-up delay-2">
              <Etiqueta>Hoy</Etiqueta>
              {verInformes ? (
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                  <div className="col-span-2 lg:row-span-2">
                    {ventasHoy.cargando ? (
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
                      <p className="rounded-3xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        No se pudieron cargar las ventas de hoy.
                      </p>
                    )}
                  </div>

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
                      abiertoEn={turnoAbierto?.abierto_en ?? null}
                      totalVentas={resumenTurno?.total_ventas ?? 0}
                    />
                  ) : (
                    informeHoy && (
                      <TarjetaKpi
                        icono={<IconMoneda />}
                        label="Ventas 7 días"
                        valor={formatPrecio(
                          ventas7.datos?.resumen.ventas_brutas ?? 0,
                        )}
                        detalle={`${ventas7.datos?.resumen.pedidos ?? 0} pedidos`}
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="mt-3 max-w-sm">
                  <TarjetaTurno
                    cargando={turno.cargando}
                    fallo={turno.fallo}
                    abiertoEn={turnoAbierto?.abierto_en ?? null}
                    totalVentas={resumenTurno?.total_ventas ?? 0}
                  />
                </div>
              )}
            </section>
          )}

          {(hayVentas || hayDerecha) && (
            <section
              className={`animate-fade-up delay-3 grid gap-4 ${
                hayVentas && hayDerecha ? 'lg:grid-cols-3' : ''
              }`}
            >
              {hayVentas && (
                <SeccionPanel
                  titulo="Ventas de los últimos 7 días"
                  subtitulo={
                    ventas7.datos
                      ? `${formatPrecio(ventas7.datos.resumen.ventas_brutas)} · ${ventas7.datos.resumen.pedidos} pedidos`
                      : undefined
                  }
                  enlace={{
                    href: '/admin/informes',
                    texto: 'Informes completos',
                  }}
                  className={hayDerecha ? 'lg:col-span-2' : ''}
                >
                  {ventas7.cargando ? (
                    <CargandoSkeleton filas={3} />
                  ) : !ventas7.datos ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Sin datos.
                    </p>
                  ) : (
                    <GraficoColumnas
                      tono="naranja"
                      nombreValor="Ventas"
                      nombreDetalle="Pedidos"
                      puntos={serie7.map((d) => ({
                        clave: d.fecha,
                        etiqueta: etiquetaCorta(d.fecha),
                        etiquetaLarga: etiquetaLarga(d.fecha),
                        valor: d.total,
                        detalle: `${d.pedidos} pedido${d.pedidos === 1 ? '' : 's'}`,
                        valorDetalle: String(d.pedidos),
                      }))}
                      formatoValor={formatPrecio}
                      formatoEje={formatoEjePesos}
                    />
                  )}
                </SeccionPanel>
              )}
              {hayDerecha && (
                <div
                  className={
                    hayVentas ? 'space-y-4' : 'grid gap-4 md:grid-cols-2'
                  }
                >
                  {panelCaja}
                  {panelNomina}
                </div>
              )}
            </section>
          )}

          <section className="animate-fade-up delay-4">
            <Etiqueta>Ir a</Etiqueta>
            <div className="mt-3">
              <AccesosModulos rol={rol} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
