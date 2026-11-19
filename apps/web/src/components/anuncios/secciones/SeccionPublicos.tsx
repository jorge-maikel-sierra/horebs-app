'use client';

import type { PanelPublicos } from '@/components/anuncios/anuncios.tipos';

const PERSONAS = new Intl.NumberFormat('es-CO');

function fecha(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function SeccionPublicos({
  panel,
  enviando,
  aviso,
  onActualizar,
}: {
  panel: PanelPublicos;
  enviando: boolean;
  aviso: string | null;
  onActualizar: () => void;
}) {
  return (
    <div className="animate-fade-up mt-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 @2xl:flex-row @2xl:items-center @2xl:justify-between dark:border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${panel.encendido ? 'bg-green-500' : 'bg-zinc-400'}`}
            />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {panel.encendido ? 'Envío a Meta encendido' : 'Envío a Meta apagado'}
            </p>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Listas de tus clientes, con los datos cifrados, para elegirlas en el Administrador de anuncios.
            {!panel.encendido && ' Se enciende cuando el aviso de privacidad esté publicado.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onActualizar}
          disabled={enviando || !panel.encendido}
          className="btn-press inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-orange/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Actualizar en Meta'}
        </button>
      </div>

      {aviso && (
        <p role="status" className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {aviso}
        </p>
      )}

      <ul className="mt-4 grid gap-3 @2xl:grid-cols-2 @2xl:gap-4 @5xl:grid-cols-3">
        {panel.segmentos.map((s, i) => (
          <li
            key={s.clave}
            className="animate-fade-up card-gradient flex flex-col justify-between rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{s.nombre}</p>
              <p className="mt-1 text-sm leading-snug text-zinc-500 dark:text-zinc-400">{s.descripcion}</p>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <p className="text-3xl font-extrabold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
                {PERSONAS.format(s.personas)}
                <span className="ml-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {s.personas === 1 ? 'persona' : 'personas'}
                </span>
              </p>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  s.audiencia_id
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {s.audiencia_id ? `En Meta · ${fecha(s.sincronizado_en)}` : 'Aún no está en Meta'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
