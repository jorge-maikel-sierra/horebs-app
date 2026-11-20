'use client';

import { useCallback, useEffect, useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatFecha } from '@/lib/formato';

type Estado = 'pendiente' | 'para_revisar' | 'respondida' | 'descartada' | 'error';

type Resena = {
  id: string;
  autor: string | null;
  estrellas: number;
  comentario: string | null;
  creada_en: string;
  estado: Estado;
  respuesta: string | null;
  respondida_en: string | null;
  error: string | null;
};

const FILTROS: { valor: Estado | 'todas'; etiqueta: string }[] = [
  { valor: 'para_revisar', etiqueta: 'Para aprobar' },
  { valor: 'pendiente', etiqueta: 'Borradores' },
  { valor: 'error', etiqueta: 'Con error' },
  { valor: 'respondida', etiqueta: 'Respondidas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

const ETIQUETA_ESTADO: Record<Estado, string> = {
  para_revisar: 'Para aprobar',
  pendiente: 'Borrador',
  respondida: 'Respondida',
  descartada: 'Descartada',
  error: 'Error al publicar',
};

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';

function Estrellas({ n }: { n: number }) {
  return (
    <span aria-label={`${n} de 5 estrellas`} className="text-brand-orange">
      {'★'.repeat(n)}
      <span className="text-zinc-300 dark:text-zinc-700">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function TarjetaResena({ r, onCambio }: { r: Resena; onCambio: () => void }) {
  const [texto, setTexto] = useState(r.respuesta ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = r.estado !== 'descartada';

  async function enviar(estado: 'respondida' | 'descartada') {
    setEnviando(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/resenas/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify(estado === 'respondida' ? { estado, respuesta: texto } : { estado }),
      });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo guardar.'));
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Estrellas n={r.estrellas} />
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{r.autor ?? 'Anónimo'}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{formatFecha(r.creada_en)}</p>
        <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {ETIQUETA_ESTADO[r.estado]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {r.comentario ?? <em className="text-zinc-600 dark:text-zinc-400">Sin comentario</em>}
      </p>
      {editable && (
        <label className="mt-3 block">
          <span className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
            Respuesta pública
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={3000}
            className={`mt-1 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${ANILLO}`}
          />
        </label>
      )}
      {r.error && r.estado === 'error' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{r.error}</p>
      )}
      {editable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void enviar('respondida')}
            disabled={enviando || !texto.trim()}
            className={`min-h-11 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 ${ANILLO}`}
          >
            {enviando ? 'Publicando…' : r.estado === 'respondida' ? 'Actualizar en Google' : 'Publicar en Google'}
          </button>
          {r.estado !== 'respondida' && (
            <button
              type="button"
              onClick={() => void enviar('descartada')}
              disabled={enviando}
              className={`min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 ${ANILLO}`}
            >
              No responder
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

export default function ResenasPage() {
  const [filtro, setFiltro] = useState<Estado | 'todas'>('para_revisar');
  const [resenas, setResenas] = useState<Resena[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const ruta = filtro === 'todas' ? '/admin/resenas' : `/admin/resenas?estado=${filtro}`;
      const res = await adminFetch(ruta);
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudieron cargar las reseñas.'));
      setResenas((await res.json()) as Resena[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reseñas.');
    }
  }, [filtro]);

  useEffect(() => {
    const id = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(id);
  }, [cargar]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Reseñas de Google
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Las de 1 a 3 estrellas esperan aquí: revisa el borrador, ajústalo si hace falta y
          publícalo. Las de 4 y 5 se responden solas cuando la publicación automática está
          activa; mientras tanto quedan en Borradores. La respuesta es pública en Google.
        </p>
      </header>

      <div role="tablist" aria-label="Filtrar reseñas" className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="tab"
            aria-selected={filtro === f.valor}
            onClick={() => {
              setResenas(null);
              setFiltro(f.valor);
            }}
            className={`min-h-11 rounded-full px-4 text-sm font-medium ${ANILLO} ${
              filtro === f.valor
                ? 'btn-gradient text-white'
                : 'border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {!resenas ? (
        <CargandoSkeleton filas={4} />
      ) : resenas.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No hay reseñas en esta lista.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {resenas.map((r) => (
            <TarjetaResena key={`${r.id}-${r.estado}`} r={r} onCambio={() => void cargar()} />
          ))}
        </ul>
      )}
    </div>
  );
}
