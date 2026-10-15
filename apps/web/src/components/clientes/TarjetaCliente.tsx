import Link from 'next/link';
import type { CSSProperties } from 'react';
import Resaltado from '@/components/pedidos/Resaltado';
import { formatPrecio } from '@/lib/formato';
import {
  claseAvatar,
  clienteDesde,
  enlaceWhatsapp,
  iniciales,
  nombreCompleto,
  tiempoRelativo,
  type ClienteDirectorio,
} from '@/lib/clientes-directorio';
import {
  IconCorreo,
  IconEstrella,
  IconPapelera,
  IconPin,
  IconTelefono,
  IconWhatsapp,
} from './iconos';

const NUMERO = new Intl.NumberFormat('es-CO');
const ACCION =
  'btn-press flex h-9 w-9 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60';

/**
 * Tarjeta de cliente. Todo el cuadro es el enlace al detalle (enlace extendido
 * con `after:`), y las acciones (WhatsApp, eliminar) quedan por encima con z-10.
 */
export default function TarjetaCliente({
  cliente: c,
  hoy,
  terminos,
  indice,
  puedeEliminar,
  onEliminar,
}: {
  cliente: ClienteDirectorio;
  hoy: string;
  terminos: string[];
  indice: number;
  puedeEliminar: boolean;
  onEliminar: (c: ClienteDirectorio) => void;
}) {
  const nombre = nombreCompleto(c);
  const whatsapp = enlaceWhatsapp(c.telefono);
  const compro = c.total_pedidos > 0;

  return (
    <article
      style={{ '--i': Math.min(indice, 8) } as CSSProperties}
      className="resultado-item card-gradient card-interactive group relative flex min-w-0 flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${claseAvatar(c.id)}`}
        >
          {iniciales(c)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
            <Link
              href={`/admin/clientes/${c.id}`}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-orange/60"
            >
              <Resaltado texto={nombre} terminos={terminos} />
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            <IconTelefono />
            {c.telefono ? (
              <Resaltado texto={c.telefono} terminos={terminos} />
            ) : (
              'Sin teléfono'
            )}
          </p>
          {c.correo && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              <IconCorreo />
              <span className="truncate">
                <Resaltado texto={c.correo} terminos={terminos} />
              </span>
            </p>
          )}
          {c.direccion && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <IconPin />
              <span className="line-clamp-1">
                <Resaltado texto={c.direccion} terminos={terminos} />
              </span>
            </p>
          )}
        </div>

        <div className="relative z-10 -mt-1 -mr-1 flex shrink-0">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ACCION} text-green-700 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-950/30`}
            >
              <IconWhatsapp />
              <span className="sr-only">
                Escribir por WhatsApp a {nombre} (se abre en una pestaña nueva)
              </span>
            </a>
          )}
          {puedeEliminar && (
            <button
              type="button"
              onClick={() => onEliminar(c)}
              className={`${ACCION} text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400`}
            >
              <IconPapelera />
              <span className="sr-only">Eliminar a {nombre}</span>
            </button>
          )}
        </div>
      </div>

      {c.puntos_actuales > 0 && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-yellow/30 px-2.5 py-0.5 text-xs font-bold text-amber-800 tabular-nums dark:bg-brand-yellow/15 dark:text-brand-yellow">
          <IconEstrella />
          {NUMERO.format(c.puntos_actuales)} puntos
        </p>
      )}

      {compro ? (
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/70">
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Pedidos
            </dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {c.total_pedidos}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Gastado
            </dt>
            <dd className="mt-0.5 [overflow-wrap:anywhere] text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatPrecio(c.total_gastado)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Último
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {c.ultimo_pedido ? tiempoRelativo(c.ultimo_pedido, hoy) : '—'}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-auto border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-400">
          Sin pedidos todavía · cliente desde {clienteDesde(c.created_at)}
        </p>
      )}
    </article>
  );
}
