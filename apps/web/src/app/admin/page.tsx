'use client';

import { useState } from 'react';
import { IconPedidos } from '@/components/admin-iconos';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import GraficoColumnas from '@/components/informes/GraficoColumnas';
import AccesosModulos from '@/components/panel/AccesosModulos';
import EncabezadoPanel from '@/components/panel/EncabezadoPanel';
import EtiquetaPanel from '@/components/panel/EtiquetaPanel';
import { IconAlerta, IconWhatsapp } from '@/components/panel/iconos';
import PanelCaja from '@/components/panel/PanelCaja';
import PanelNomina, {
  type FilaTableroNomina,
} from '@/components/panel/PanelNomina';
import SeccionHoy, {
  type InformeResumen,
} from '@/components/panel/SeccionHoy';
import SeccionPanel from '@/components/panel/SeccionPanel';
import TarjetaAtencion from '@/components/panel/TarjetaAtencion';
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
  const nomina = useCarga<FilaTableroNomina[]>(verNomina ? '/nomina/tablero' : null);

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
  const serie7 = ventas7.datos?.serie_diaria ?? [];
  const turnoAbierto = turno.datos?.turno ?? null;
  const resumenTurno = turno.datos?.resumen;

  const hayVentas = verInformes;
  const hayDerecha = verCaja || verNomina;

  const panelCaja = verCaja && (
    <PanelCaja
      cargando={turno.cargando}
      fallo={turno.fallo}
      abierto={turnoAbierto !== null}
      montos={{
        efectivo: resumenTurno?.total_efectivo ?? 0,
        transferencia: resumenTurno?.total_transferencia ?? 0,
        tarjeta: resumenTurno?.total_tarjeta ?? 0,
      }}
    />
  );

  const panelNomina = verNomina && (
    <PanelNomina
      cargando={nomina.cargando}
      fallo={nomina.fallo}
      filas={nomina.datos}
    />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <EncabezadoPanel rol={rol} />

      {cargandoModulos ? (
        <CargandoSkeleton filas={4} />
      ) : (
        <div className="mt-8 space-y-8">
          {tarjetasAtencion.length > 0 && (
            <section
              aria-labelledby="panel-atencion"
              className="animate-fade-up delay-1"
            >
              <EtiquetaPanel id="panel-atencion">Atención requerida</EtiquetaPanel>
              <div
                className={`mt-3 grid gap-4 ${COLUMNAS_ATENCION[tarjetasAtencion.length]}`}
              >
                {tarjetasAtencion}
              </div>
            </section>
          )}

          {(verInformes || verCaja) && (
            <SeccionHoy
              verInformes={verInformes}
              verCaja={verCaja}
              cargandoHoy={ventasHoy.cargando}
              informeHoy={ventasHoy.datos}
              informeAyer={ventasAyer.datos}
              informe7={ventas7.datos}
              turno={{
                cargando: turno.cargando,
                fallo: turno.fallo,
                abiertoEn: turnoAbierto?.abierto_en ?? null,
                totalVentas: resumenTurno?.total_ventas ?? 0,
              }}
            />
          )}

          {(hayVentas || hayDerecha) && (
            <div
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
                    <p
                      role="alert"
                      className="text-sm text-red-600 dark:text-red-400"
                    >
                      No se pudieron cargar las ventas de la semana.
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
            </div>
          )}

          <section
            aria-labelledby="panel-accesos"
            className="animate-fade-up delay-4"
          >
            <EtiquetaPanel id="panel-accesos">Ir a</EtiquetaPanel>
            <div className="mt-3">
              <AccesosModulos rol={rol} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
