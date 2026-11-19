'use client';

import { formatFecha, formatPrecio } from '@/lib/formato';
import { CANAL_CAMPANA_LABEL, type CampanaConResultado } from '@/lib/campanas-mensajeria';

const COLOR_CANAL: Record<string, string> = {
  whatsapp_business: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400',
  whatsapp_bot: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400',
  messenger: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-400',
};

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{etiqueta}</dt>
      <dd className="mt-0.5 truncate text-base font-bold text-zinc-900 tabular-nums dark:text-zinc-50">{valor}</dd>
    </div>
  );
}

export default function TarjetaCampana({
  campana: c,
  ocupada,
  onEditar,
  onCambiarActiva,
}: {
  campana: CampanaConResultado;
  ocupada: boolean;
  onEditar: () => void;
  onCambiarActiva: () => void;
}) {
  const r = c.resultado;
  return (
    <li
      className={`card-gradient flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 ${
        c.activa ? '' : 'opacity-60'
      }`}
    >
      {c.creativo_url && (
        <div className="aspect-video bg-zinc-100 dark:bg-zinc-900">
          {c.creativo_tipo === 'video' ? (
            <video src={c.creativo_url} controls preload="metadata" className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- creativo del bucket público de Supabase
            <img src={c.creativo_url} alt={`Creativo de ${c.nombre}`} loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${COLOR_CANAL[c.canal] ?? ''}`}>
            {CANAL_CAMPANA_LABEL[c.canal]}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatFecha(c.enviada_en)}</span>
          {!c.activa && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Inactiva
            </span>
          )}
        </div>
        <p className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">{c.nombre}</p>
        <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-400">{c.mensaje}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Metrica etiqueta="Pedidos" valor={String(r.pedidos)} />
          <Metrica etiqueta="Ventas" valor={formatPrecio(r.ventas)} />
          <Metrica etiqueta="Costo" valor={c.costo != null ? formatPrecio(c.costo) : 'Sin dato'} />
          <Metrica etiqueta="Retorno (ventas / costo)" valor={r.roas != null ? `${r.roas}x` : '—'} />
          <Metrica etiqueta="Costo por pedido" valor={r.costo_por_pedido != null ? formatPrecio(r.costo_por_pedido) : '—'} />
          <Metrica etiqueta="Utilidad bruta" valor={formatPrecio(r.utilidad_bruta)} />
        </dl>

        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={onEditar}
            disabled={ocupada}
            className="btn-press h-10 flex-1 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onCambiarActiva}
            disabled={ocupada}
            className="btn-press h-10 flex-1 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300"
          >
            {c.activa ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </li>
  );
}
