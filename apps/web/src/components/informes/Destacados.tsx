import type { ReactNode } from 'react';
import { formatPrecio } from '@/lib/formato';
import { diasEntre } from '@/lib/informes-rango';
import { IconArticulos, IconClienteNuevo, IconMoto, IconPedidos } from '@/components/informes/iconos';
import { plural, type InformeDto } from '@/components/informes/informes.tipos';

const UN_DECIMAL = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

function Dato({
  icono,
  titulo,
  valor,
  nota,
}: {
  icono: ReactNode;
  titulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-accent-ink">
        {icono}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {titulo}
        </p>
        <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{valor}</p>
        <p className="truncate text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{nota}</p>
      </div>
    </li>
  );
}

/** Lecturas rápidas del período que no merecen un gráfico propio. */
export default function Destacados({ informe }: { informe: InformeDto }) {
  const r = informe.resumen;
  const estrella = informe.top_productos[0];
  const dias = diasEntre(informe.desde, informe.hasta);
  const pctDomicilio = r.ventas_brutas > 0 ? (r.costo_domicilio_total / r.ventas_brutas) * 100 : 0;
  const pctEstrella = estrella && r.ventas_brutas > 0 ? (estrella.total / r.ventas_brutas) * 100 : 0;

  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Lo destacado</h2>
      <ul className="mt-4 grid gap-5 @lg:grid-cols-2 @4xl:grid-cols-1">
        <Dato
          icono={<IconArticulos />}
          titulo="Producto estrella"
          valor={estrella ? estrella.nombre : 'Sin ventas'}
          nota={
            estrella
              ? `${formatPrecio(estrella.total)} · ${UN_DECIMAL.format(pctEstrella)}% de las ventas`
              : '—'
          }
        />
        <Dato
          icono={<IconPedidos />}
          titulo="Pedidos por día"
          valor={UN_DECIMAL.format(r.pedidos / dias)}
          nota={`${plural(r.pedidos, 'pedido')} en ${plural(dias, 'día')}`}
        />
        <Dato
          icono={<IconMoto />}
          titulo="Domicilio cobrado"
          valor={formatPrecio(r.costo_domicilio_total)}
          nota={`${UN_DECIMAL.format(pctDomicilio)}% de las ventas brutas`}
        />
        <Dato
          icono={<IconClienteNuevo />}
          titulo="Clientes nuevos"
          valor={String(informe.clientes.nuevos)}
          nota={`${plural(informe.clientes.recurrentes, 'recurrente')} volvieron a comprar`}
        />
      </ul>
    </section>
  );
}
