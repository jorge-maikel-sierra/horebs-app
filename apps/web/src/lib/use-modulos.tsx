'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useRol } from '@/lib/use-rol';
import { MODULOS, type ModuloId } from '@/lib/modulos';

type Estados = Record<ModuloId, boolean>;

type ValorModulos = {
  /** true hasta que llega la primera respuesta del API. */
  cargando: boolean;
  activo: (id: ModuloId) => boolean;
  /** Enciende o apaga un módulo; devuelve false si el API lo rechazó. */
  cambiar: (id: ModuloId, activo: boolean) => Promise<boolean>;
};

const TODOS_ACTIVOS = Object.fromEntries(
  MODULOS.map((m) => [m.id, true]),
) as Estados;

const ModulosContexto = createContext<ValorModulos>({
  cargando: false,
  activo: () => true,
  cambiar: async () => false,
});

export function ModulosProvider({ children }: { children: ReactNode }) {
  const { session } = useRol();
  const [estados, setEstados] = useState<Estados>(TODOS_ACTIVOS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!session) return;
    let vigente = true;
    adminFetch('/admin/modulos')
      .then(async (res) => {
        if (!res.ok) throw new Error('modulos');
        const filas: { id: ModuloId; activo: boolean }[] = await res.json();
        if (!vigente) return;
        setEstados({
          ...TODOS_ACTIVOS,
          ...Object.fromEntries(filas.map((f) => [f.id, f.activo])),
        });
      })
      // Si el API falla se deja todo activo: un error de red no debe dejar
      // al personal sin acceso al panel.
      .catch(() => undefined)
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  const activo = useCallback(
    (id: ModuloId) => estados[id] !== false,
    [estados],
  );

  const cambiar = useCallback(async (id: ModuloId, valor: boolean) => {
    // Optimista: el menú reacciona al instante y se revierte si falla.
    setEstados((prev) => ({ ...prev, [id]: valor }));
    try {
      const res = await adminFetch(`/admin/modulos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: valor }),
      });
      if (!res.ok) throw new Error('cambiar');
      return true;
    } catch {
      setEstados((prev) => ({ ...prev, [id]: !valor }));
      return false;
    }
  }, []);

  const valor = useMemo(
    () => ({ cargando, activo, cambiar }),
    [cargando, activo, cambiar],
  );

  return (
    <ModulosContexto.Provider value={valor}>
      {children}
    </ModulosContexto.Provider>
  );
}

export function useModulos(): ValorModulos {
  return useContext(ModulosContexto);
}
