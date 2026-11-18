'use client';

import { useCallback, useEffect, useState } from 'react';
import CargandoSkeleton from '@/components/CargandoSkeleton';
import RequireRol from '@/components/RequireRol';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { formatPrecio } from '@/lib/formato';

type Variante = {
  id: string;
  producto: string;
  variante: string;
  precio: number;
  costo: number | null;
  margen: number | null;
  margen_pct: number | null;
};

type Lista = {
  variantes: Variante[];
  resumen: { variantes: number; con_costo: number; sin_costo: number };
};

type Rentabilidad = {
  desde: string;
  hasta: string;
  pedidos: number;
  ventas_productos: number;
  utilidad_bruta: number;
  margen_pct: number | null;
  cobertura_costos: number | null;
};

const ANILLO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]';

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
        {etiqueta}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {valor}
      </p>
    </div>
  );
}

function FilaVariante({
  v,
  onGuardado,
}: {
  v: Variante;
  onGuardado: (v: Variante) => void;
}) {
  const [texto, setTexto] = useState(v.costo === null ? '' : String(v.costo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const original = v.costo === null ? '' : String(v.costo);
  const cambio = texto.trim() !== original;

  async function guardar() {
    const limpio = texto.trim();
    const costo = Number(limpio);
    if (limpio !== '' && (!Number.isFinite(costo) || costo < 0)) {
      setError('Escribe un valor en pesos, sin signos.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res =
        limpio === ''
          ? await adminFetch(`/admin/costos/variantes/${v.id}`, { method: 'DELETE' })
          : await adminFetch(`/admin/costos/variantes/${v.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ costo }),
            });
      if (!res.ok) throw new Error(await leerErrorApi(res, 'No se pudo guardar.'));
      onGuardado(
        limpio === ''
          ? { ...v, costo: null, margen: null, margen_pct: null }
          : ((await res.json()) as Variante),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[1fr_6rem_9rem_9rem_5.5rem] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{v.producto}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{v.variante}</p>
      </div>
      <p className="text-sm tabular-nums text-zinc-900 sm:text-right dark:text-zinc-50">
        {formatPrecio(v.precio)}
      </p>
      <label className="block">
        <span className="sr-only">Costo de {v.producto} {v.variante}</span>
        <input
          inputMode="numeric"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && cambio) void guardar();
          }}
          placeholder="Sin costo"
          className={`min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${ANILLO}`}
        />
      </label>
      <p className="text-sm tabular-nums text-zinc-900 sm:text-right dark:text-zinc-50">
        {v.margen === null ? '—' : `${formatPrecio(v.margen)} · ${v.margen_pct}%`}
      </p>
      <button
        type="button"
        onClick={() => void guardar()}
        disabled={!cambio || guardando}
        className={`min-h-11 rounded-lg bg-zinc-900 px-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 ${ANILLO}`}
      >
        {guardando ? '…' : 'Guardar'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 sm:col-span-5 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

function PaginaCostos() {
  const [lista, setLista] = useState<Lista | null>(null);
  const [rentabilidad, setRentabilidad] = useState<Rentabilidad | null>(null);
  const [soloSinCosto, setSoloSinCosto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        adminFetch('/admin/costos'),
        adminFetch('/admin/costos/rentabilidad'),
      ]);
      if (!a.ok) throw new Error(await leerErrorApi(a, 'No se pudieron cargar los costos.'));
      setLista((await a.json()) as Lista);
      if (b.ok) setRentabilidad((await b.json()) as Rentabilidad);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los costos.');
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(id);
  }, [cargar]);

  const variantes = (lista?.variantes ?? []).filter((v) => !soloSinCosto || v.costo === null);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Costos y margen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Escribe lo que cuesta producir cada presentación. Con eso la plataforma calcula cuánto deja
          cada venta y cada campaña. Al cambiar un costo, el cálculo de las ventas anteriores usa el
          costo nuevo.
        </p>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {!lista ? (
        <CargandoSkeleton filas={6} />
      ) : (
        <>
          <section aria-label="Resumen" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra
              etiqueta="Con costo cargado"
              valor={`${lista.resumen.con_costo} de ${lista.resumen.variantes}`}
            />
            <Cifra
              etiqueta="Utilidad bruta (30 días)"
              valor={rentabilidad ? formatPrecio(rentabilidad.utilidad_bruta) : '—'}
            />
            <Cifra
              etiqueta="Margen"
              valor={rentabilidad?.margen_pct == null ? '—' : `${rentabilidad.margen_pct}%`}
            />
            <Cifra
              etiqueta="Ventas con costo"
              valor={rentabilidad?.cobertura_costos == null ? '—' : `${rentabilidad.cobertura_costos}%`}
            />
          </section>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            La utilidad solo cuenta los pedidos donde todos los productos tienen costo; el porcentaje
            de ventas con costo te dice qué tan completa es la cifra.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={soloSinCosto}
                onChange={(e) => setSoloSinCosto(e.target.checked)}
              />
              Mostrar solo las que no tienen costo
            </label>
          </div>

          <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {variantes.map((v) => (
              <FilaVariante
                key={`${v.id}-${v.costo ?? 'x'}`}
                v={v}
                onGuardado={() => void cargar()}
              />
            ))}
          </ul>
          {variantes.length === 0 && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              Todas las presentaciones ya tienen costo.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function CostosPage() {
  return (
    <RequireRol roles={['admin']}>
      <PaginaCostos />
    </RequireRol>
  );
}
