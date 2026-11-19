'use client';

import { useCallback, useState } from 'react';
import { formatPrecio } from '@/lib/formato';
import { calcularDelta, etiquetaCorta, etiquetaLarga } from '@/lib/informes-rango';
import GraficoColumnas from '@/components/informes/GraficoColumnas';
import ModalClientes, { type ModoClientes } from '@/components/informes/ModalClientes';
import Panel from '@/components/informes/Panel';
import RankingBarras from '@/components/informes/RankingBarras';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconClienteNuevo, IconClienteRecurrente, IconTicket } from '@/components/informes/iconos';
import { plural, type ContextoSeccion } from '@/components/informes/informes.tipos';

export default function SeccionClientes({ informe, anterior, vs, etiqueta }: ContextoSeccion) {
  const [modal, setModal] = useState<ModoClientes | null>(null);
  const cerrar = useCallback(() => setModal(null), []);
  const c = informe.clientes;
  const ca = anterior?.clientes;

  return (
    <>
      <h2 className="mt-8 text-lg font-bold text-zinc-900 dark:text-zinc-50">Clientes</h2>

      <div className="mt-3 grid grid-cols-2 gap-3 @2xl:grid-cols-3 @2xl:gap-4">
        <TarjetaKpi
          tono="verde"
          icono={<IconClienteNuevo />}
          label="Clientes nuevos"
          valor={String(c.nuevos)}
          detalle="Primera compra en este período"
          accion="Ver clientes"
          onClick={() => setModal('nuevos')}
          delta={calcularDelta(c.nuevos, ca?.nuevos)}
          vs={vs}
          serie={c.serie_diaria_nuevos.map((d) => d.nuevos)}
        />
        <TarjetaKpi
          tono="azul"
          icono={<IconClienteRecurrente />}
          label="Clientes recurrentes"
          valor={String(c.recurrentes)}
          detalle="Ya habían comprado antes"
          accion="Ver clientes"
          onClick={() => setModal('recurrentes')}
          delta={calcularDelta(c.recurrentes, ca?.recurrentes)}
          vs={vs}
        />
        <div className="col-span-2 @2xl:col-span-1">
          <TarjetaKpi
            tono="amarillo"
            icono={<IconTicket />}
            label="Ticket promedio por cliente"
            valor={formatPrecio(c.ticket_promedio)}
            delta={calcularDelta(c.ticket_promedio, ca?.ticket_promedio)}
            vs={vs}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 @3xl:grid-cols-12">
        <Panel
          className="@3xl:col-span-7"
          titulo="Clientes nuevos por día"
          subtitulo="Primera compra registrada"
        >
          <GraficoColumnas
            tono="azul"
            nombreValor="Clientes nuevos"
            enteros
            puntos={c.serie_diaria_nuevos.map((d) => ({
              clave: d.fecha,
              etiqueta: etiquetaCorta(d.fecha),
              etiquetaLarga: etiquetaLarga(d.fecha),
              valor: d.nuevos,
            }))}
            formatoValor={(n) => plural(n, 'nuevo')}
            formatoEje={(n) => String(n)}
          />
        </Panel>
        <Panel
          className="@3xl:col-span-5"
          titulo="Clientes con más gasto"
          subtitulo="Ranking por total comprado en el período"
        >
          <RankingBarras
            numerado
            tono="azul"
            vacio="Sin clientes activos en este rango."
            filas={c.top_clientes.map((t) => ({
              clave: t.id,
              etiqueta: t.nombre || 'Cliente sin nombre',
              extra: t.telefono ?? undefined,
              valor: t.total,
              detalle: plural(t.pedidos, 'pedido'),
            }))}
          />
        </Panel>
      </div>

      {modal && (
        <ModalClientes
          modo={modal}
          clientes={(modal === 'nuevos' ? c.lista_nuevos : c.lista_recurrentes) ?? []}
          total={modal === 'nuevos' ? c.nuevos : c.recurrentes}
          periodo={etiqueta}
          onCerrar={cerrar}
        />
      )}
    </>
  );
}
