'use client';

import { useEffect, useRef, useState } from 'react';

export type PuntoColumna = {
  clave: string;
  etiqueta: string;
  etiquetaLarga: string;
  valor: number;
  /** Texto del tooltip, ej. "30 pedidos". */
  detalle?: string;
  /** Valor crudo para la columna de detalle de la tabla, ej. "30". */
  valorDetalle?: string;
};

export type TonoGrafico = 'naranja' | 'azul';

// Pasos validados con validate_palette.js (claro y oscuro): contraste >= 3:1
// contra la superficie y separación CVD suficiente entre ambos tonos.
export const COLOR_MARCA: Record<TonoGrafico, string> = {
  naranja: 'bg-[#eb6834] dark:bg-[#d95926]',
  azul: 'bg-[#2a78d6] dark:bg-[#3987e5]',
};

const ALTO_PLOT = 208;
const ANCHO_MIN_ETIQUETA = 56;

function escalaAgradable(max: number, enteros: boolean) {
  if (max <= 0) return { tope: 1, ticks: [0, 1] };
  const bruto = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  let paso =
    (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) *
    mag;
  if (enteros) paso = Math.max(1, Math.ceil(paso));
  const intervalos = Math.ceil(max / paso);
  return {
    tope: intervalos * paso,
    ticks: Array.from({ length: intervalos + 1 }, (_, i) => i * paso),
  };
}

export default function GraficoColumnas({
  puntos,
  tono,
  nombreValor,
  nombreDetalle,
  formatoValor,
  formatoEje,
  enteros = false,
}: {
  puntos: PuntoColumna[];
  tono: TonoGrafico;
  nombreValor: string;
  nombreDetalle?: string;
  formatoValor: (n: number) => string;
  formatoEje: (n: number) => string;
  enteros?: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState<number | null>(null);
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) =>
      setAncho(entrada.contentRect.width),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (puntos.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sin datos en este rango.
      </p>
    );
  }

  const n = puntos.length;
  const maxValor = Math.max(...puntos.map((p) => p.valor));
  const { tope, ticks } = escalaAgradable(maxValor, enteros);
  const pct = (v: number) => (v / tope) * 100;
  const idxMejor =
    maxValor > 0 && n > 1 ? puntos.findIndex((p) => p.valor === maxValor) : -1;
  const maxEtiquetas = Math.max(2, Math.floor(ancho / ANCHO_MIN_ETIQUETA));
  const paso = Math.max(1, Math.ceil(n / maxEtiquetas));

  function alternar(i: number) {
    setActivo((actual) => (actual === i ? null : i));
  }

  return (
    <div>
      <div
        className="mt-10 flex"
        role="group"
        aria-label={`Gráfico de columnas: ${nombreValor}`}
      >
        <div
          className="relative w-14 shrink-0"
          style={{ height: ALTO_PLOT }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-[11px] leading-none text-zinc-500 tabular-nums dark:text-zinc-400"
              style={{ bottom: `${pct(t)}%` }}
            >
              {formatoEje(t)}
            </span>
          ))}
        </div>

        <div ref={plotRef} className="min-w-0 flex-1">
          <div className="relative" style={{ height: ALTO_PLOT }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t border-zinc-200 dark:border-zinc-800"
                style={{ bottom: `${pct(t)}%` }}
              />
            ))}

            <div className="absolute inset-0 flex">
              {puntos.map((p, i) => {
                const alto = pct(p.valor);
                const esActivo = activo === i;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    onClick={() => alternar(i)}
                    onPointerEnter={(e) =>
                      e.pointerType === 'mouse' && setActivo(i)
                    }
                    onPointerLeave={(e) =>
                      e.pointerType === 'mouse' && setActivo(null)
                    }
                    onFocus={() => setActivo(i)}
                    onBlur={() => setActivo((a) => (a === i ? null : a))}
                    aria-label={`${p.etiquetaLarga}: ${formatoValor(p.valor)}${p.detalle ? `, ${p.detalle}` : ''}`}
                    className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                      esActivo ? 'bg-zinc-900/[0.05] dark:bg-white/[0.07]' : ''
                    }`}
                  >
                    {p.valor > 0 && (
                      <span
                        className={`w-[calc(100%-2px)] max-w-6 rounded-t-[4px] transition-[filter] ${COLOR_MARCA[tono]} ${
                          esActivo ? 'brightness-110' : ''
                        }`}
                        style={{ height: `max(${alto}%, 2px)` }}
                      />
                    )}
                    {i === idxMejor && !esActivo && (
                      <span
                        className={`pointer-events-none absolute text-[11px] leading-none font-semibold whitespace-nowrap text-zinc-700 tabular-nums dark:text-zinc-200 ${
                          i === 0
                            ? 'left-0'
                            : i === n - 1
                              ? 'right-0'
                              : 'left-1/2 -translate-x-1/2'
                        }`}
                        style={{ bottom: `calc(${alto}% + 6px)` }}
                      >
                        {formatoEje(p.valor)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activo !== null && (
              <div
                className="pointer-events-none absolute z-20 w-max max-w-[220px] rounded-lg bg-zinc-900 px-2.5 py-1.5 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                style={{
                  left: `${((activo + 0.5) / n) * 100}%`,
                  bottom: `calc(${pct(puntos[activo].valor)}% + 10px)`,
                  transform: `translateX(${
                    activo / n < 0.2
                      ? '-15%'
                      : activo / n > 0.7
                        ? '-85%'
                        : '-50%'
                  })`,
                }}
              >
                <p className="flex items-baseline gap-2 leading-tight">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatoValor(puntos[activo].valor)}
                  </span>
                  {puntos[activo].detalle && (
                    <span className="text-[11px] text-white/75 dark:text-zinc-600">
                      {puntos[activo].detalle}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight text-white/75 dark:text-zinc-600">
                  <span
                    className={`inline-block h-0.5 w-3 shrink-0 rounded ${COLOR_MARCA[tono]}`}
                  />
                  <span className="inline-block first-letter:uppercase">
                    {puntos[activo].etiquetaLarga}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="flex h-7" aria-hidden="true">
            {puntos.map((p, i) => (
              <div key={p.clave} className="relative min-w-0 flex-1">
                {(n - 1 - i) % paso === 0 && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] leading-none whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {p.etiqueta}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setVerTabla((v) => !v)}
        aria-expanded={verTabla}
        className="mt-1 text-xs font-semibold text-zinc-500 transition-colors hover:text-accent-ink dark:text-zinc-400"
      >
        {verTabla ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>

      {verTabla && (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 text-right font-medium">
                  {nombreValor}
                </th>
                {nombreDetalle && (
                  <th className="px-3 py-2 text-right font-medium">
                    {nombreDetalle}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {puntos.map((p) => (
                <tr
                  key={p.clave}
                  className="border-t border-zinc-100 dark:border-zinc-800/70"
                >
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap text-zinc-600 first-letter:uppercase sm:text-sm dark:text-zinc-300">
                    {p.etiquetaLarga}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                    {formatoValor(p.valor)}
                  </td>
                  {nombreDetalle && (
                    <td className="px-3 py-1.5 text-right text-zinc-600 tabular-nums dark:text-zinc-300">
                      {p.valorDetalle ?? ''}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
