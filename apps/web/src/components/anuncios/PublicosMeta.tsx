'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';

type Segmento = {
  clave: string;
  nombre: string;
  descripcion: string;
  personas: number;
  audiencia_id: string | null;
  enviadas: number | null;
  sincronizado_en: string | null;
};

type Panel = { encendido: boolean; segmentos: Segmento[] };

type Resultado = {
  estado: 'sincronizado' | 'apagado';
  enviadas: { clave: string; personas: number }[];
  parecido: string;
  errores: string[];
};

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';

function fecha(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function PublicosMeta() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await adminFetch('/admin/audiencias');
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudieron cargar los públicos.'));
      setPanel((await res.json()) as Panel);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los públicos.');
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(id);
  }, [cargar]);

  async function sincronizar() {
    setEnviando(true);
    setAviso(null);
    try {
      const res = await adminFetch('/admin/audiencias/sincronizaciones', { method: 'POST' });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo sincronizar.'));
      const r = (await res.json()) as Resultado;
      setAviso(
        r.estado === 'apagado'
          ? 'Los envíos a Meta están apagados.'
          : r.errores.length > 0
            ? `Con errores: ${r.errores.join(' · ')}`
            : `Listo: ${r.enviadas.length} públicos actualizados.`,
      );
      await cargar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'No se pudo sincronizar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-label="Públicos de Meta" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Públicos de Meta</h2>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={enviando || !panel?.encendido}
          className={`min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900 ${ANILLO}`}
        >
          {enviando ? 'Enviando…' : 'Actualizar en Meta'}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Listas de tus clientes (con datos cifrados) para elegir en el Administrador de anuncios:
        recompra, excluir a quien compró esta semana y público parecido a tus mejores clientes.
        {panel && !panel.encendido && ' El envío a Meta está apagado: se enciende cuando el aviso de privacidad esté publicado.'}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {aviso}
        </p>
      )}
      {panel && (
        <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {panel.segmentos.map((s) => (
            <li key={s.clave} className="grid gap-2 p-4 sm:grid-cols-[1fr_7rem_12rem] sm:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{s.nombre}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.descripcion}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-zinc-900 sm:text-right dark:text-zinc-50">
                {s.personas} personas
              </p>
              <p className="text-xs text-zinc-600 sm:text-right dark:text-zinc-400">
                {s.audiencia_id ? `En Meta · ${fecha(s.sincronizado_en)}` : 'Aún no está en Meta'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
