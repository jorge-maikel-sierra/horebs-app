'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import Campo from '@/components/formulario/Campo';
import { FOCO, TARJETA, claseCampo } from '@/components/formulario/estilos';
import { formatPrecio } from '@/lib/formato';
import { adminFetch } from '@/lib/admin-fetch';
import { IconEstrella } from './iconos';

export type ConfiguracionPuntos = {
  puntosPor1000Pesos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
  puntosVencimientoMeses: number;
};

const CAMPOS: {
  clave: keyof ConfiguracionPuntos;
  etiqueta: string;
  ayuda: string;
}[] = [
  {
    clave: 'puntosPor1000Pesos',
    etiqueta: 'Puntos por cada $ 1.000 gastados',
    ayuda: 'Lo que gana el cliente en cada compra.',
  },
  {
    clave: 'valorPuntoPesos',
    etiqueta: 'Valor de cada punto (pesos)',
    ayuda: 'Descuento que da cada punto al canjearlo.',
  },
  {
    clave: 'puntosMinimoCanje',
    etiqueta: 'Mínimo de puntos para canjear',
    ayuda: 'Por debajo de esto no se puede canjear.',
  },
  {
    clave: 'puntosVencimientoMeses',
    etiqueta: 'Vencimiento por inactividad (meses)',
    ayuda: 'Sin compras en este tiempo, los puntos vencen.',
  },
];

function resumen(c: ConfiguracionPuntos) {
  const pts = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
  return [
    `${pts(c.puntosPor1000Pesos)} por cada ${formatPrecio(1000)}`,
    `cada punto vale ${formatPrecio(c.valorPuntoPesos)}`,
    `canje desde ${pts(c.puntosMinimoCanje)}`,
    `vencen a los ${c.puntosVencimientoMeses} ${c.puntosVencimientoMeses === 1 ? 'mes' : 'meses'} sin compras`,
  ].join(' · ');
}

/** Reglas del programa de puntos: resumen siempre visible y edición plegable (solo admin). */
export default function ProgramaFidelidad({
  onConfig,
  onAviso,
}: {
  onConfig: (config: ConfiguracionPuntos) => void;
  onAviso: (texto: string, error?: boolean) => void;
}) {
  const uid = useId();
  const [config, setConfig] = useState<ConfiguracionPuntos | null>(null);
  const [fallo, setFallo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    adminFetch('/admin/puntos/configuracion')
      .then((res) =>
        res.ok ? (res.json() as Promise<ConfiguracionPuntos>) : null,
      )
      .catch(() => null)
      .then((data) => {
        if (!vigente) return;
        if (data) {
          setConfig(data);
          onConfig(data);
        } else {
          setFallo(true);
        }
      });
    return () => {
      vigente = false;
    };
    // onConfig solo avisa al padre; no debe re-disparar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setGuardando(true);
    try {
      const res = await adminFetch('/admin/puntos/configuracion', {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('guardar');
      onConfig(config);
      onAviso('Reglas de fidelidad guardadas');
      setAbierto(false);
    } catch {
      onAviso('No se pudo guardar la configuración', true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className={TARJETA} aria-labelledby={`${uid}-titulo`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/30 text-amber-700 dark:bg-brand-yellow/15 dark:text-brand-yellow">
          <IconEstrella tamano={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`${uid}-titulo`}
            className="font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Programa de fidelidad
          </h2>
          {fallo ? (
            <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">
              No se pudieron cargar las reglas.
            </p>
          ) : config ? (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {resumen(config)}
            </p>
          ) : (
            <div
              className="skeleton mt-1.5 h-4 w-3/4 max-w-md"
              aria-hidden="true"
            />
          )}
        </div>
        <button
          type="button"
          disabled={!config}
          aria-expanded={abierto}
          aria-controls={`${uid}-form`}
          onClick={() => setAbierto((v) => !v)}
          className={`btn-press h-10 w-full shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-accent-ink disabled:opacity-50 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 ${FOCO}`}
        >
          {abierto ? 'Cerrar' : 'Ajustar reglas'}
        </button>
      </div>

      {abierto &&
        (config ? (
          <form
            id={`${uid}-form`}
            onSubmit={guardar}
            className="animate-desplegar mt-4 grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800"
          >
            {CAMPOS.map((campo) => {
              const id = `${uid}-${campo.clave}`;
              return (
                <Campo
                  key={campo.clave}
                  id={id}
                  etiqueta={campo.etiqueta}
                  ayuda={campo.ayuda}
                >
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    required
                    value={config[campo.clave]}
                    aria-describedby={`${id}-ayuda`}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [campo.clave]: Number(e.target.value),
                      })
                    }
                    className={claseCampo(false)}
                  />
                </Campo>
              );
            })}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={guardando}
                className="btn-gradient btn-press h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-brand-orange/25 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar reglas'}
              </button>
            </div>
          </form>
        ) : (
          <CargandoSkeleton filas={1} />
        ))}
    </section>
  );
}
