'use client';

import { formatPrecio } from '@/lib/formato';
import { calcularDelta } from '@/lib/informes-rango';
import Panel from '@/components/informes/Panel';
import { TarjetaKpi } from '@/components/informes/TarjetasResumen';
import { IconChat, IconMoneda, IconPedidos, IconTendencia } from '@/components/informes/iconos';
import type { ContextoSeccion } from '@/components/informes/informes.tipos';

function porcentaje(valor: number) {
  return `${Math.round(valor * 100)}%`;
}

/** Filas "etiqueta — valor" para el embudo y la fidelización del bot. */
function ListaValores({ filas }: { filas: { etiqueta: string; valor: string }[] }) {
  return (
    <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">{f.etiqueta}</dt>
          <dd className="text-sm font-bold text-zinc-900 tabular-nums dark:text-zinc-50">{f.valor}</dd>
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
      <h2 className="mt-8 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Bots de mensajería (WhatsApp, Messenger, Instagram)
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel titulo="Embudo" subtitulo="De la conversación a la entrega">
          <ListaValores
            filas={[
              { etiqueta: 'Conversaciones', valor: String(b.conversaciones) },
              { etiqueta: 'Pedidos creados por el bot', valor: String(b.pedidos) },
              { etiqueta: 'Entregados', valor: String(b.entregados) },
              { etiqueta: 'Cancelados', valor: String(b.cancelados) },
              { etiqueta: 'Pasadas a una persona', valor: String(b.derivaciones) },
            ]}
          />
        </Panel>
        <Panel titulo="Fidelización" subtitulo="Lo que hace volver al cliente">
          <ListaValores
            filas={[
              { etiqueta: 'Toques en "Pedir lo mismo"', valor: String(b.repetir_toques) },
              { etiqueta: 'Invitaciones a repetir enviadas', valor: String(b.recompras_enviadas) },
              { etiqueta: 'Reservas', valor: String(b.reservas) },
              { etiqueta: 'Comprobantes recibidos', valor: String(b.comprobantes) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
