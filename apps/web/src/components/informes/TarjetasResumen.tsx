'use client';

import type { ReactNode } from 'react';
import Sparkline from '@/components/informes/Sparkline';
import type { Delta } from '@/lib/informes-rango';

const PCT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

function textoDelta(d: Delta): string {
  if (d.tipo === 'nuevo') return 'Nuevo';
  if (d.tipo === 'igual') return '= 0%';
  return `${d.tipo === 'sube' ? '▲' : '▼'} ${PCT.format(d.pct)}%`;
}

function descripcionDelta(d: Delta, vs: string): string {
  if (d.tipo === 'nuevo') return `Sin ventas en ${vs}`;
  if (d.tipo === 'igual') return `Igual que ${vs}`;
  return `${PCT.format(d.pct)}% ${d.tipo === 'sube' ? 'más' : 'menos'} que ${vs}`;
}

export function DeltaPill({
  delta,
  vs,
  sobreFondoColor = false,
}: {
  delta: Delta | null;
  vs: string;
  sobreFondoColor?: boolean;
}) {
  if (!delta) return null;
  const estilo = sobreFondoColor
    ? 'bg-white/20 text-white'
    : delta.tipo === 'sube'
      ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
      : delta.tipo === 'baja'
        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  return (
    <span
      title={descripcionDelta(delta, vs)}
      aria-label={descripcionDelta(delta, vs)}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${estilo}`}
    >
      {textoDelta(delta)}
    </span>
  );
}

export function HeroVentas({
  icono,
  valor,
  periodo,
  delta,
  vs,
  serie,
  mejorDia,
}: {
  icono: ReactNode;
  valor: string;
  periodo: string;
  delta: Delta | null;
  vs: string;
  serie: number[];
  mejorDia?: string;
}) {
  return (
    <div className="btn-gradient relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-brand-orange/25 sm:p-6">
      <span className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute top-24 -left-10 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              {icono}
            </span>
            <span className="truncate text-xs font-bold tracking-widest uppercase">
              Ventas brutas
            </span>
          </div>
          <DeltaPill delta={delta} vs={vs} sobreFondoColor />
        </div>

        <p className="mt-4 [overflow-wrap:anywhere] text-4xl leading-none font-extrabold tracking-tight tabular-nums sm:text-5xl">
          {valor}
        </p>
        <p className="mt-2 text-sm font-medium text-white/90">{periodo}</p>
        {mejorDia && (
          <p className="mt-0.5 text-xs text-white/85">Mejor día: {mejorDia}</p>
        )}
      </div>

      <Sparkline
        datos={serie}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full text-white/90"
      />
    </div>
  );
}

export type TonoKpi = 'naranja' | 'azul' | 'amarillo' | 'verde';

const TONOS: Record<TonoKpi, { chip: string; spark: string }> = {
  naranja: {
    chip: 'bg-brand-orange/15 text-brand-orange',
    spark: 'text-brand-orange',
  },
  azul: {
    chip: 'bg-blue-100 text-brand-navy dark:bg-blue-400/15 dark:text-blue-300',
    spark: 'text-brand-navy dark:text-blue-300',
  },
  amarillo: {
    chip: 'bg-brand-yellow/30 text-amber-700 dark:bg-brand-yellow/15 dark:text-brand-yellow',
    spark: 'text-amber-500 dark:text-brand-yellow',
  },
  verde: {
    chip: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
    spark: 'text-green-600 dark:text-green-400',
  },
};

export function TarjetaKpi({
  icono,
  label,
  valor,
  detalle,
  delta,
  vs,
  serie,
  tono = 'naranja',
}: {
  icono: ReactNode;
  label: string;
  valor: string;
  detalle?: string;
  delta?: Delta | null;
  vs?: string;
  serie?: number[];
  tono?: TonoKpi;
}) {
  const t = TONOS[tono];
  return (
    <div className="card-gradient card-interactive relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 p-4 sm:p-5 dark:border-zinc-800">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.chip}`}
          >
            {icono}
          </span>
          <DeltaPill delta={delta ?? null} vs={vs ?? 'el período anterior'} />
        </div>
        <p className="mt-3 text-[11px] leading-tight font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </p>
        <p className="mt-1 [overflow-wrap:anywhere] text-xl font-extrabold tracking-tight tabular-nums text-zinc-900 sm:text-2xl dark:text-zinc-50">
          {valor}
        </p>
        {detalle && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {detalle}
          </p>
        )}
      </div>
      {serie && serie.length > 1 && (
        <Sparkline datos={serie} className={`mt-3 h-8 w-full ${t.spark}`} />
      )}
    </div>
  );
}

export function TiraDomicilio({
  icono,
  valor,
  porcentaje,
}: {
  icono: ReactNode;
  valor: string;
  porcentaje: number;
}) {
  const ancho = Math.min(100, Math.max(0, porcentaje));
  return (
    <div className="card-gradient card-interactive flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
          {icono}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] leading-tight font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Domicilio cobrado
          </p>
          <p className="[overflow-wrap:anywhere] text-xl font-extrabold tracking-tight tabular-nums text-zinc-900 sm:text-2xl dark:text-zinc-50">
            {valor}
          </p>
        </div>
      </div>
      <div className="sm:w-1/2">
        <div className="flex items-baseline justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Peso sobre las ventas</span>
          <span className="font-bold text-zinc-700 tabular-nums dark:text-zinc-200">
            {PCT.format(porcentaje)}%
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-valuenow={Math.round(ancho)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Domicilio como porcentaje de las ventas brutas"
        >
          <div
            className="btn-gradient h-full rounded-full"
            style={{ width: `${ancho}%` }}
          />
        </div>
      </div>
    </div>
  );
}
