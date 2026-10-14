'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPrecio } from '@/lib/formato';

export type ClienteLista = {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  total: number;
  primera_compra: string;
};

export type ModoClientes = 'nuevos' | 'recurrentes';

const TEXTOS: Record<ModoClientes, { titulo: string; descripcion: string }> = {
  nuevos: {
    titulo: 'Clientes nuevos',
    descripcion: 'Hicieron su primera compra en este período',
  },
  recurrentes: {
    titulo: 'Clientes recurrentes',
    descripcion: 'Ya habían comprado antes de este período',
  },
};

// Las fechas del negocio se muestran siempre en hora de Bogotá.
const FECHA_COMPRA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function IconBuscar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconCerrar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function ModalClientes({
  modo,
  clientes,
  total,
  periodo,
  onCerrar,
}: {
  modo: ModoClientes;
  clientes: ClienteLista[];
  total: number;
  periodo: string;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const dialogoRef = useRef<HTMLDivElement>(null);
  const textos = TEXTOS[modo];

  useEffect(() => {
    dialogoRef.current?.focus();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        normalizar(c.nombre).includes(q) ||
        (c.telefono ?? '').includes(q.replace(/\s/g, '')),
    );
  }, [clientes, busqueda]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} />
      <div
        ref={dialogoRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-clientes"
        className="animate-fade-up relative flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-zinc-200 bg-white pt-5 shadow-2xl outline-none sm:max-w-md sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <span className="mx-auto mb-3 block h-1 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" />

        <div className="flex items-start justify-between gap-3 px-5">
          <div className="min-w-0">
            <h2
              id="titulo-modal-clientes"
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              {textos.titulo}
              <span className="ml-2 text-sm font-semibold text-zinc-500 tabular-nums dark:text-zinc-400">
                {total}
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {textos.descripcion}
            </p>
            <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              {periodo}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="btn-press shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <IconCerrar />
          </button>
        </div>

        {clientes.length > 5 && (
          <label className="mx-5 mt-3 flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-400 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20 dark:border-zinc-700 dark:bg-zinc-900">
            <IconBuscar />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              aria-label="Buscar cliente"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
            />
          </label>
        )}

        <ul className="mt-3 min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto px-5 pb-2 dark:divide-zinc-800/70">
          {filtrados.length === 0 ? (
            <li className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {clientes.length === 0
                ? 'Sin clientes en este período.'
                : 'Ningún cliente coincide con la búsqueda.'}
            </li>
          ) : (
            filtrados.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-sm font-bold text-brand-orange">
                  {(c.nombre.trim().charAt(0) || '?').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {c.nombre}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {c.telefono ?? 'Sin teléfono'}
                    {modo === 'nuevos' &&
                      ` · Primera compra ${FECHA_COMPRA.format(new Date(c.primera_compra)).replace(/\./g, '')}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
                    {formatPrecio(c.total)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.pedidos} pedido{c.pedidos === 1 ? '' : 's'}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>

        <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800/70 dark:text-zinc-400">
          {clientes.length < total
            ? `Mostrando ${clientes.length} de ${total}${modo === 'nuevos' ? ' (los más recientes)' : ' (los de mayor gasto)'}.`
            : `${total} cliente${total === 1 ? '' : 's'} en el período.`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
