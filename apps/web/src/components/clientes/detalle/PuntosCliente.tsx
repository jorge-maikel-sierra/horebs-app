'use client';

import { useId, useState, type FormEvent } from 'react';
import Campo from '@/components/formulario/Campo';
import { FOCO, TARJETA, claseCampo } from '@/components/formulario/estilos';
import { formatFecha } from '@/lib/formato';
import type {
  ClienteDetalle,
  MovimientoPuntos,
} from '@/lib/clientes-directorio';
import { IconEstrella } from '../iconos';

const NUMERO = new Intl.NumberFormat('es-CO');
const POR_LOTE = 6;

const TIPO: Record<MovimientoPuntos['tipo'], { texto: string; clase: string }> =
  {
    ganado: {
      texto: 'Ganado',
      clase:
        'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
    },
    canjeado: {
      texto: 'Canjeado',
      clase: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    },
    vencido: {
      texto: 'Vencido',
      clase: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    },
    ajuste: {
      texto: 'Ajuste manual',
      clase:
        'bg-blue-100 text-brand-navy dark:bg-blue-400/15 dark:text-blue-300',
    },
  };

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

export default function PuntosCliente({
  cliente,
  movimientos,
  esAdmin,
  onAjustar,
}: {
  cliente: ClienteDetalle;
  movimientos: MovimientoPuntos[];
  esAdmin: boolean;
  /** Devuelve el mensaje de error, o null si el ajuste se registró. */
  onAjustar: (puntos: number, motivo: string) => Promise<string | null>;
}) {
  const uid = useId();
  const [puntos, setPuntos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{
    puntos?: string;
    motivo?: string;
    general?: string;
  }>({});
  const [enviando, setEnviando] = useState(false);
  const [visibles, setVisibles] = useState(POR_LOTE);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const n = Number(puntos);
    const nuevos: typeof errores = {};
    if (!puntos.trim() || !Number.isFinite(n) || Math.round(n) === 0) {
      nuevos.puntos =
        'Escribe una cantidad distinta de cero (usa un número negativo para restar).';
    }
    if (!motivo.trim()) nuevos.motivo = 'Escribe el motivo del ajuste.';
    setErrores(nuevos);
    if (nuevos.puntos || nuevos.motivo) return;

    setEnviando(true);
    const error = await onAjustar(Math.round(n), motivo.trim());
    setEnviando(false);
    if (error) {
      setErrores({ general: error });
      return;
    }
    setPuntos('');
    setMotivo('');
  }

  return (
    <section className={TARJETA} aria-labelledby={`${uid}-titulo`}>
      <h2 id={`${uid}-titulo`} className="sr-only">
        Puntos de fidelidad
      </h2>

      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow/30 text-amber-700 dark:bg-brand-yellow/15 dark:text-brand-yellow">
          <IconEstrella tamano={22} />
        </span>
        <div>
          <p className="text-2xl font-extrabold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
            {NUMERO.format(cliente.puntos_actuales)}{' '}
            <span className="text-base font-semibold text-zinc-500 dark:text-zinc-400">
              puntos
            </span>
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {cliente.puntos_ultima_actividad
              ? `Última actividad: ${formatFecha(cliente.puntos_ultima_actividad)}`
              : 'Sin actividad todavía'}
          </p>
        </div>
      </div>

      {esAdmin && (
        <form
          onSubmit={enviar}
          noValidate
          className="mt-4 space-y-3 rounded-2xl border border-zinc-200 p-3.5 dark:border-zinc-800"
        >
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Ajuste manual
          </p>
          <Campo
            id={`${uid}-puntos`}
            etiqueta="Puntos (+ suma, − resta)"
            error={errores.puntos}
          >
            <input
              id={`${uid}-puntos`}
              type="number"
              inputMode="numeric"
              value={puntos}
              placeholder="Ej. 50 o -30"
              aria-invalid={Boolean(errores.puntos)}
              aria-describedby={
                errores.puntos ? `${uid}-puntos-error` : undefined
              }
              onChange={(e) => setPuntos(e.target.value)}
              className={claseCampo(Boolean(errores.puntos))}
            />
          </Campo>
          <Campo id={`${uid}-motivo`} etiqueta="Motivo" error={errores.motivo}>
            <input
              id={`${uid}-motivo`}
              value={motivo}
              placeholder="Ej. Compensación por pedido tardío"
              autoComplete="off"
              aria-invalid={Boolean(errores.motivo)}
              aria-describedby={
                errores.motivo ? `${uid}-motivo-error` : undefined
              }
              onChange={(e) => setMotivo(e.target.value)}
              className={claseCampo(Boolean(errores.motivo))}
            />
          </Campo>
          {errores.general && (
            <p
              role="alert"
              className="text-sm font-medium text-red-600 dark:text-red-400"
            >
              {errores.general}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className={`btn-press h-11 w-full rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 transition-colors hover:border-accent-ink disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 ${FOCO}`}
          >
            {enviando ? 'Guardando…' : 'Aplicar ajuste'}
          </button>
        </form>
      )}

      <h3 className="mt-5 text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
        Historial de puntos
      </h3>
      {movimientos.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Sin movimientos todavía.
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {movimientos.slice(0, visibles).map((m) => {
              const tipo = TIPO[m.tipo] ?? {
                texto: m.tipo,
                clase: TIPO.canjeado.clase,
              };
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tipo.clase}`}
                    >
                      {tipo.texto}
                    </span>
                    <p className="mt-1 text-xs [overflow-wrap:anywhere] text-zinc-600 dark:text-zinc-300">
                      {m.motivo ??
                        (m.referencia_tipo === 'pedido' ? 'Pedido' : '—')}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {FECHA_HORA.format(new Date(m.created_at))}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-base font-bold tabular-nums ${
                      m.puntos >= 0
                        ? 'text-green-700 dark:text-green-500'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {m.puntos >= 0 ? '+' : '−'}
                    {NUMERO.format(Math.abs(m.puntos))}
                  </p>
                </li>
              );
            })}
          </ul>
          {movimientos.length > visibles && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + POR_LOTE)}
              className={`btn-press mt-2 h-10 w-full rounded-xl text-sm font-semibold text-accent-ink hover:bg-brand-orange/10 ${FOCO}`}
            >
              Ver más ({movimientos.length - visibles})
            </button>
          )}
        </>
      )}
    </section>
  );
}
