'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { leerErrorApi } from '@/lib/error-api';

type Resultado<T> = { clave: string; datos: T };
type Falla = { clave: string; mensaje: string };

/**
 * GET autenticado a `ruta` (null = todavía no se pide, ej. una pestaña que no
 * se abrió). Mientras llega una respuesta nueva se conservan los datos
 * anteriores en pantalla; una respuesta vieja que llegue tarde no pisa a la
 * nueva.
 */
export function useRecurso<T>(ruta: string | null, mensajeError: string) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  const clave = `${ruta}|${intento}`;

  useEffect(() => {
    if (!ruta) return;
    let vigente = true;
    adminFetch(ruta)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerErrorApi(res, mensajeError));
        return (await res.json()) as T;
      })
      .then((datos) => {
        if (vigente) setResultado({ clave, datos });
      })
      .catch((err: unknown) => {
        if (vigente) setFalla({ clave, mensaje: err instanceof Error ? err.message : mensajeError });
      });
    return () => {
      vigente = false;
    };
  }, [ruta, clave, mensajeError]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  const error = falla?.clave === clave ? falla.mensaje : null;

  return {
    datos: resultado?.datos ?? null,
    /** Hay un pedido en curso para la ruta actual. */
    cargando: Boolean(ruta) && resultado?.clave !== clave && !error,
    error,
    recargar,
  };
}
