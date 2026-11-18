'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

type Campana = { id: string; nombre: string; sugerida: boolean };

/**
 * "¿Por qué anuncio llegó?" — solo aparece si Meta ya sincronizó campañas con
 * gasto. Queda elegida la campaña del mes (la que más gastó este mes) y se
 * puede cambiar o dejar en «Ninguno / no sé». `valor` en null significa que
 * todavía no se ha elegido nada: ahí se pone la del mes.
 */
export default function SelectorCampana({
  valor,
  onCambio,
}: {
  valor: string | null;
  onCambio: (id: string) => void;
}) {
  const [campanas, setCampanas] = useState<Campana[]>([]);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const res = await adminFetch('/admin/anuncios/campanas-recientes');
        if (!res.ok) return;
        const datos = (await res.json()) as Campana[];
        if (vigente) setCampanas(datos);
      } catch {
        // Sin la lista la caja sigue vendiendo: es un dato opcional.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (valor !== null) return;
    const delMes = campanas.find((c) => c.sugerida);
    if (delMes) onCambio(delMes.id);
  }, [valor, campanas, onCambio]);

  if (campanas.length === 0) return null;

  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
        ¿Por qué anuncio llegó?
      </span>
      <select
        value={valor ?? ''}
        onChange={(e) => onCambio(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
      >
        <option value="">Ninguno / no sé</option>
        {campanas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
