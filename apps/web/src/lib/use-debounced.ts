'use client';

import { useEffect, useState } from 'react';

/** Devuelve `valor` tras `ms` sin cambios; evita recalcular y re-animar listas en cada tecla. */
export function useDebounced<T>(valor: T, ms: number): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}
