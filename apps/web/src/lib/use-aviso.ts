'use client';

import { useCallback, useEffect, useState } from 'react';

export type Aviso = { texto: string; error: boolean };

const DURACION_MS = 3500;

/** Aviso efímero (toast): se oculta solo y cada aviso nuevo reinicia el tiempo. */
export function useAviso() {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  const mostrar = useCallback(
    (texto: string, error = false) => setAviso({ texto, error }),
    [],
  );

  return { aviso, mostrar };
}
