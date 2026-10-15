'use client';

import { useEffect, useRef } from 'react';
import Segmentado from '@/components/formulario/Segmentado';
import { FOCO } from '@/components/formulario/estilos';
import type {
  Directorio,
  OrdenClientes,
  Segmento,
} from '@/lib/clientes-directorio';
import { IconLupa, IconX } from './iconos';

const ORDENES: { valor: OrdenClientes; texto: string }[] = [
  { valor: 'auto', texto: 'Mejor coincidencia' },
  { valor: 'recientes', texto: 'Más recientes' },
  { valor: 'ultimo', texto: 'Compró hace menos' },
  { valor: 'nombre', texto: 'Nombre (A-Z)' },
  { valor: 'pedidos', texto: 'Más pedidos' },
  { valor: 'gasto', texto: 'Mayor gasto' },
  { valor: 'puntos', texto: 'Más puntos' },
];

export default function FiltrosClientes({
  q,
  onQ,
  segmento,
  onSegmento,
  orden,
  onOrden,
  conteos,
}: {
  q: string;
  onQ: (q: string) => void;
  segmento: Segmento;
  onSegmento: (s: Segmento) => void;
  orden: OrdenClientes;
  onOrden: (o: OrdenClientes) => void;
  conteos: Directorio['conteos'] | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo "/" para enfocar el buscador, como en Pedidos.
  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3.5 text-zinc-500 shadow-sm transition focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        <IconLupa />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && q) {
              e.preventDefault();
              onQ('');
            }
          }}
          placeholder="Buscar por nombre, teléfono, dirección, correo o cédula…"
          aria-label="Buscar clientes"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-12 min-w-0 flex-1 appearance-none bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm dark:text-zinc-50 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              onQ('');
              inputRef.current?.focus();
            }}
            aria-label="Borrar búsqueda"
            className={`btn-press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${FOCO}`}
          >
            <IconX />
          </button>
        ) : (
          <kbd
            aria-hidden="true"
            className="hidden h-6 min-w-6 items-center justify-center rounded-md border border-zinc-300 px-1.5 font-mono text-xs text-zinc-500 sm:flex dark:border-zinc-700 dark:text-zinc-400"
          >
            /
          </kbd>
        )}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Segmentado
          etiqueta="Tipo de cliente"
          valor={segmento}
          onCambiar={onSegmento}
          opciones={[
            { valor: 'todos', texto: 'Todos', conteo: conteos?.todos },
            {
              valor: 'recurrentes',
              texto: 'Recurrentes',
              conteo: conteos?.recurrentes,
            },
            {
              valor: 'nuevos',
              texto: 'Nuevos (30 días)',
              conteo: conteos?.nuevos,
            },
            {
              valor: 'sin_pedidos',
              texto: 'Sin pedidos',
              conteo: conteos?.sin_pedidos,
            },
            {
              valor: 'con_puntos',
              texto: 'Con puntos',
              conteo: conteos?.con_puntos,
            },
          ]}
        />
        <label className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-zinc-300 bg-white pr-1 pl-3.5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="whitespace-nowrap">Ordenar</span>
          <select
            value={orden}
            onChange={(e) => onOrden(e.target.value as OrdenClientes)}
            className={`h-8 cursor-pointer rounded-lg bg-transparent pr-1 pl-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50 ${FOCO}`}
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor} className="text-zinc-900">
                {o.texto}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
