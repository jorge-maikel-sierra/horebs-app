'use client';

import { useId, useState } from 'react';
import ModuloIcono from '@/components/ModuloIcono';
import { FOCO, TARJETA } from '@/components/formulario/estilos';
import { MODULOS, type ModuloId } from '@/lib/modulos';
import { useModulos } from '@/lib/use-modulos';

export default function SeccionModulos({
  onAviso,
}: {
  onAviso: (texto: string, error?: boolean) => void;
}) {
  const uid = useId();
  const { cargando, activo, cambiar } = useModulos();
  const [pendiente, setPendiente] = useState<ModuloId | null>(null);

  const activos = MODULOS.filter((m) => activo(m.id)).length;

  async function alternar(id: ModuloId, etiqueta: string) {
    if (pendiente) return;
    const nuevo = !activo(id);
    setPendiente(id);
    const ok = await cambiar(id, nuevo);
    setPendiente(null);
    onAviso(
      ok
        ? `Módulo ${etiqueta} ${nuevo ? 'activado' : 'desactivado'}`
        : `No se pudo cambiar ${etiqueta}. Inténtalo de nuevo.`,
      !ok,
    );
  }

  return (
    <section className={TARJETA} aria-labelledby={`${uid}-titulo`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${uid}-titulo`}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Módulos del panel
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Activa solo lo que usas. Un módulo desactivado se oculta del menú y
            del Panel para todo el personal; sus datos no se borran y puedes
            volver a activarlo cuando quieras.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
          {cargando ? '…' : `${activos} de ${MODULOS.length} activos`}
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-brand-orange/10 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
        Esta sección solo la ve el administrador. Afecta a lo que se muestra en
        este panel; no cambia la tienda web ni el bot de WhatsApp.
      </p>

      <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
        {MODULOS.map((m) => {
          const encendido = activo(m.id);
          const idBase = `${uid}-${m.id}`;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3 sm:gap-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  encendido
                    ? 'bg-brand-orange/15 text-accent-ink'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                <ModuloIcono id={m.id} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    id={`${idBase}-nombre`}
                    className="font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    {m.etiqueta}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                      encendido
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        encendido
                          ? 'bg-green-600 dark:bg-green-400'
                          : 'border border-zinc-500 dark:border-zinc-400'
                      }`}
                    />
                    {encendido ? 'Activo' : 'Desactivado'}
                  </span>
                </p>
                <p
                  id={`${idBase}-desc`}
                  className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {m.descripcion}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={encendido}
                aria-labelledby={`${idBase}-nombre`}
                aria-describedby={`${idBase}-desc`}
                disabled={cargando || pendiente !== null}
                onClick={() => alternar(m.id, m.etiqueta)}
                className={`group flex h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-60 ${FOCO}`}
              >
                <span
                  className={`flex h-7 w-12 items-center rounded-full px-1 transition-colors ${
                    encendido ? 'btn-gradient' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      encendido ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
