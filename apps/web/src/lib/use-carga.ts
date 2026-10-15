'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

/**
 * GET autenticado de solo lectura. Con `ruta` en null no consulta nada (rol
 * sin permiso, módulo apagado) y no cuenta como "cargando". El resultado se
 * guarda junto a la ruta que lo produjo: así `cargando` se deriva sin
 * setState síncrono dentro del efecto.
 */
export function useCarga<T>(ruta: string | null) {
  const [resultado, setResultado] = useState<{
    ruta: string;
    datos: T | null;
  } | null>(null);

  useEffect(() => {
    if (!ruta) return;
    let vigente = true;
    adminFetch(ruta)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
      .then((datos) => {
        if (vigente) setResultado({ ruta, datos });
      });
    return () => {
      vigente = false;
    };
  }, [ruta]);

  const listo = ruta !== null && resultado?.ruta === ruta;
  return {
    datos: listo ? resultado.datos : null,
    cargando: ruta !== null && !listo,
    fallo: listo && resultado.datos === null,
  };
}
