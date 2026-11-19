'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';
import { rangoAnterior } from '@/lib/informes-rango';
import type { InformeDto } from '@/components/informes/informes.tipos';

async function pedir(desde: string, hasta: string): Promise<InformeDto> {
  const res = await adminFetch(`/informes?desde=${desde}&hasta=${hasta}`);
  if (!res.ok) {
    throw new Error(await leerErrorApi(res, 'No se pudo cargar el informe.'));
  }
  return res.json();
}

type Resultado = { clave: string; informe: InformeDto; anterior: InformeDto | null };
type Falla = { clave: string; mensaje: string };

/**
 * Carga el informe del rango y el del período anterior (para ▲/▼). Mientras
 * llega un rango nuevo se conserva el informe previo en pantalla, así la
 * página no vuelve al skeleton en cada cambio de período.
 */
export function useInforme(desde: string, hasta: string) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  const clave = `${desde}|${hasta}|${intento}`;

  useEffect(() => {
    if (!desde || !hasta) return;
    // Si el rango cambia dos veces seguidas, la respuesta vieja que llegue
    // tarde no puede pisar a la nueva.
    let vigente = true;
    const previo = rangoAnterior(desde, hasta);
    // El período anterior solo alimenta las comparaciones: si falla, el
    // informe principal se muestra igual, sin porcentajes.
    Promise.all([pedir(desde, hasta), pedir(previo.desde, previo.hasta).catch(() => null)])
      .then(([informe, anterior]) => {
        if (vigente) setResultado({ clave, informe, anterior });
      })
      .catch((err: unknown) => {
        if (vigente) {
          setFalla({ clave, mensaje: err instanceof Error ? err.message : 'Error desconocido.' });
        }
      });
    return () => {
      vigente = false;
    };
  }, [desde, hasta, clave]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  const error = falla?.clave === clave ? falla.mensaje : null;

  return {
    informe: resultado?.informe ?? null,
    anterior: resultado?.anterior ?? null,
    /** Hay un pedido en curso para el rango actual. */
    cargando: resultado?.clave !== clave && !error,
    error,
    reintentar,
  };
}
