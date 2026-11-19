'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import {
  CANAL_CAMPANA_LABEL,
  type CampanaMensajeria,
  type CanalCampana,
} from '@/lib/campanas-mensajeria';

type CampanaMeta = { id: string; nombre: string; sugerida: boolean };

/** Lo que la caja manda al API según la campaña elegida. */
export type CamposCampana = {
  origen_campana_id?: string;
  campana_mensajeria_id?: string;
};

const PREFIJO_META = 'meta:';
const PREFIJO_PROPIA = 'propia:';
// Una difusión trae pedidos sobre todo los primeros días; después se sugiere
// la de Meta del mes, como antes.
const HORAS_SUGERENCIA_PROPIA = 72;
// En el selector solo las campañas propias recientes, para que no crezca sin fin.
const DIAS_VISIBLES_PROPIAS = 30;
const MS_POR_HORA = 3_600_000;

/** Canal de campaña propia que corresponde a cada origen de la caja. */
const CANAL_DE_ORIGEN: Record<string, CanalCampana | undefined> = {
  whatsapp: 'whatsapp_business',
  whatsapp_bot: 'whatsapp_bot',
  messenger: 'messenger',
  instagram: 'instagram',
};

/** Traduce el valor del selector (`meta:<id>` o `propia:<uuid>`) al body de la venta. */
export function camposCampana(valor: string | null): CamposCampana {
  if (valor?.startsWith(PREFIJO_META)) {
    return { origen_campana_id: valor.slice(PREFIJO_META.length) };
  }
  if (valor?.startsWith(PREFIJO_PROPIA)) {
    return { campana_mensajeria_id: valor.slice(PREFIJO_PROPIA.length) };
  }
  return {};
}

function haceHoras(fecha: string): number {
  return (Date.now() - new Date(fecha).getTime()) / MS_POR_HORA;
}

function sugerencia(
  origen: string,
  propias: CampanaMensajeria[],
  meta: CampanaMeta[],
): string | null {
  if (origen === 'mostrador') return null;
  const canal = CANAL_DE_ORIGEN[origen];
  const propia = canal
    ? propias.find(
        (c) => c.canal === canal && haceHoras(c.enviada_en) <= HORAS_SUGERENCIA_PROPIA,
      )
    : undefined;
  if (propia) return `${PREFIJO_PROPIA}${propia.id}`;
  const delMes = meta.find((c) => c.sugerida);
  return delMes ? `${PREFIJO_META}${delMes.id}` : null;
}

async function leerLista<T>(ruta: string): Promise<T[]> {
  try {
    const res = await adminFetch(ruta);
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch {
    // Sin la lista la caja sigue vendiendo: la campaña es un dato opcional.
    return [];
  }
}

/**
 * "¿Por qué campaña llegó?" — campañas de Meta Ads y campañas propias
 * (difusiones de WhatsApp Business, bot, Messenger, Instagram). Si la caja aún
 * no eligió nada (`valor` null) se sugiere la propia del canal de los últimos
 * 3 días o, si no hay, la de Meta del mes. En el local no se sugiere nada.
 */
export default function SelectorCampana({
  valor,
  origen,
  onCambio,
}: {
  valor: string | null;
  origen: string;
  onCambio: (valor: string) => void;
}) {
  const [meta, setMeta] = useState<CampanaMeta[]>([]);
  const [propias, setPropias] = useState<CampanaMensajeria[]>([]);

  useEffect(() => {
    let vigente = true;
    void Promise.all([
      leerLista<CampanaMeta>('/admin/anuncios/campanas-recientes'),
      leerLista<CampanaMensajeria>('/admin/campanas-mensajeria?activas=true'),
    ]).then(([deMeta, deCanal]) => {
      if (!vigente) return;
      setMeta(deMeta);
      setPropias(
        deCanal.filter(
          (c) => haceHoras(c.enviada_en) <= DIAS_VISIBLES_PROPIAS * 24,
        ),
      );
    });
    return () => {
      vigente = false;
    };
  }, []);

  const sugerida = useMemo(
    () => sugerencia(origen, propias, meta),
    [origen, propias, meta],
  );

  useEffect(() => {
    if (valor === null && sugerida) onCambio(sugerida);
  }, [valor, sugerida, onCambio]);

  if (meta.length === 0 && propias.length === 0) return null;

  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
        ¿Por qué campaña llegó?
      </span>
      <select
        value={valor ?? ''}
        onChange={(e) => onCambio(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
      >
        <option value="">Ninguna / no sé</option>
        {propias.length > 0 && (
          <optgroup label="Campañas propias">
            {propias.map((c) => (
              <option key={c.id} value={`${PREFIJO_PROPIA}${c.id}`}>
                {c.nombre} · {CANAL_CAMPANA_LABEL[c.canal]}
              </option>
            ))}
          </optgroup>
        )}
        {meta.length > 0 && (
          <optgroup label="Anuncios de Meta">
            {meta.map((c) => (
              <option key={c.id} value={`${PREFIJO_META}${c.id}`}>
                {c.nombre}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
