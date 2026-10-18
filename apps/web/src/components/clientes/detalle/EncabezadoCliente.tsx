import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  claseAvatar,
  clienteDesde,
  diasDesde,
  enlaceWhatsapp,
  iniciales,
  nombreCompleto,
  type ClienteDetalle,
} from '@/lib/clientes-directorio';
import {
  IconCorreo,
  IconLapiz,
  IconPapelera,
  IconTelefono,
  IconVolver,
  IconWhatsapp,
} from '../iconos';

const BOTON =
  'btn-press inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60';

function Etiqueta({
  children,
  tono,
}: {
  children: ReactNode;
  tono: 'naranja' | 'verde' | 'azul' | 'gris';
}) {
  const estilos = {
    naranja: 'bg-brand-orange/15 text-accent-ink',
    verde:
      'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
    azul: 'bg-blue-100 text-brand-navy dark:bg-blue-400/15 dark:text-blue-300',
    gris: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${estilos[tono]}`}
    >
      {children}
    </span>
  );
}

export default function EncabezadoCliente({
  cliente: c,
  hoy,
  esAdmin,
  editando,
  onEditar,
  onEliminar,
}: {
  cliente: ClienteDetalle;
  hoy: string;
  esAdmin: boolean;
  editando: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const nombre = nombreCompleto(c);
  const whatsapp = enlaceWhatsapp(c.telefono);
  const digitos = (c.telefono ?? '').replace(/\D/g, '');
  const esNuevo = c.created_at ? diasDesde(c.created_at, hoy) < 30 : false;

  return (
    <header className="animate-fade-up">
      <Link
        href="/admin/clientes"
        className="inline-flex h-9 items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-zinc-500 outline-none hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:text-zinc-400"
      >
        <IconVolver />
        Clientes
      </Link>

      <div className="card-gradient mt-2 flex flex-col gap-5 rounded-3xl border border-zinc-200 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold sm:h-20 sm:w-20 sm:text-2xl ${claseAvatar(c.id)}`}
          >
            {iniciales(c)}
          </span>
          <div className="min-w-0">
            <h1 className="[overflow-wrap:anywhere] text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              {nombre}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {c.total_pedidos >= 2 ? (
                <Etiqueta tono="verde">Recurrente</Etiqueta>
              ) : c.total_pedidos === 1 ? (
                <Etiqueta tono="naranja">Compró una vez</Etiqueta>
              ) : (
                <Etiqueta tono="gris">Sin pedidos</Etiqueta>
              )}
              {esNuevo && <Etiqueta tono="azul">Nuevo</Etiqueta>}
              {c.created_at && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Cliente desde {clienteDesde(c.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BOTON} border-green-300 text-green-700 hover:bg-green-50 dark:border-green-900/60 dark:text-green-400 dark:hover:bg-green-950/30`}
            >
              <IconWhatsapp />
              WhatsApp
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          )}
          {digitos && (
            <a
              href={`tel:${digitos}`}
              className={`${BOTON} border-zinc-300 text-zinc-700 hover:border-accent-ink dark:border-zinc-700 dark:text-zinc-300`}
            >
              <IconTelefono tamano={16} />
              Llamar
            </a>
          )}
          {c.correo && (
            <a
              href={`mailto:${c.correo}`}
              className={`${BOTON} border-zinc-300 text-zinc-700 hover:border-accent-ink dark:border-zinc-700 dark:text-zinc-300`}
            >
              <IconCorreo tamano={16} />
              Correo
            </a>
          )}
          <button
            type="button"
            aria-pressed={editando}
            onClick={onEditar}
            className={`${BOTON} ${
              editando
                ? 'border-brand-orange bg-brand-orange/10 text-accent-ink'
                : 'border-zinc-300 text-zinc-700 hover:border-accent-ink dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            <IconLapiz />
            {editando ? 'Cancelar edición' : 'Editar datos'}
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={onEliminar}
              className={`${BOTON} border-red-200 text-red-600 hover:border-red-400 dark:border-red-900/50 dark:text-red-400 dark:hover:border-red-700`}
            >
              <IconPapelera />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
