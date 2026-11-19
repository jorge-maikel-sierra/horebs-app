'use client';

import { formatPrecio } from '@/lib/formato';
import { calcularDelta } from '@/lib/informes-rango';
import EmbudoBot from '@/components/informes/EmbudoBot';
import Panel from '@/components/informes/Panel';
import { GraficoVentasDiarias } from '@/components/informes/secciones/SeccionResumen';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconChat, IconMoneda, IconPedidos, IconTendencia } from '@/components/informes/iconos';
import type { ContextoSeccion } from '@/components/informes/informes.tipos';

function porcentaje(valor: number) {
  return `${Math.round(valor * 100)}%`;
}

/** Cifras sueltas de fidelización: cada una es un conteo sin comparación. */
function Cifras({ filas }: { filas: { etiqueta: string; valor: number }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex flex-col-reverse justify-end rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/70">
          <dt className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{f.etiqueta}</dt>
          <dd className="text-2xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
            {f.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function SeccionBots({ informe, anterior, vs }: ContextoSeccion) {
  const b = informe.bot;
  if (!b) return null;
  const ba = anterior?.bot;

  return (
    <>
      <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
        Lo que hicieron los bots de WhatsApp, Messenger e Instagram en el período.
      </p>
      <div className="animate-fade-up mt-3 grid grid-cols-2 gap-3 @2xl:grid-cols-4 @2xl:gap-4">
        <TarjetaKpi
          tono="azul"
          icono={<IconChat />}
          label="Conversaciones"
          valor={String(b.conversaciones)}
          detalle="Clientes que le escribieron al bot"
          delta={calcularDelta(b.conversaciones, ba?.conversaciones)}
          vs={vs}
        />
        <TarjetaKpi
          tono="naranja"
          icono={<IconPedidos />}
          label="Pedidos del bot"
          valor={String(b.pedidos)}
          delta={calcularDelta(b.pedidos, ba?.pedidos)}
          vs={vs}
          serie={b.serie_diaria.map((d) => d.pedidos)}
        />
        <TarjetaKpi
          tono="verde"
          icono={<IconTendencia />}
          label="Conversión"
          valor={porcentaje(b.conversion)}
          detalle="Pedidos por cada conversación"
          delta={calcularDelta(b.conversion, ba?.conversion)}
          vs={vs}
        />
        <TarjetaKpi
          tono="amarillo"
          icono={<IconMoneda />}
          label="Ventas del bot"
          valor={formatPrecio(b.ventas)}
          detalle={`Ticket promedio ${formatPrecio(b.ticket_promedio)}`}
          delta={calcularDelta(b.ventas, ba?.ventas)}
          vs={vs}
          serie={b.serie_diaria.map((d) => d.total)}
        />
      </div>

      <div className="mt-4 grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-12">
        <Panel className="@4xl:col-span-7" titulo="Embudo" subtitulo="De la conversación a la entrega">
          <EmbudoBot bot={b} />
        </Panel>
        <Panel className="@4xl:col-span-5" titulo="Fidelización" subtitulo="Lo que hace volver al cliente">
          <Cifras
            filas={[
              { etiqueta: 'Toques en "Pedir lo mismo"', valor: b.repetir_toques },
              { etiqueta: 'Invitaciones a repetir enviadas', valor: b.recompras_enviadas },
              { etiqueta: 'Reservas', valor: b.reservas },
              { etiqueta: 'Comprobantes recibidos', valor: b.comprobantes },
            ]}
          />
        </Panel>
      </div>

      {b.serie_diaria.length > 1 && (
        <div className="mt-4">
          <Panel titulo="Ventas del bot por día" subtitulo="Pedidos que el bot dejó creados">
            <GraficoVentasDiarias datos={b.serie_diaria} />
          </Panel>
        </div>
      )}
    </>
  );
}
