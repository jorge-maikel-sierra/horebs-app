'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type Rol = 'admin' | 'empleado';

type EstadoRol = {
  cargando: boolean;
  session: Session | null;
  rol: Rol | null;
};

/**
 * Chequeo de rol del lado del cliente — sirve para mostrar/ocultar UI y
 * redirigir. La seguridad real vive en el guard del API (RolesGuard),
 * que valida el token contra Supabase en cada request.
 */
export function useRol(): EstadoRol {
  const [estado, setEstado] = useState<EstadoRol>({
    cargando: true,
    session: null,
    rol: null,
  });

  useEffect(() => {
    let activo = true;

    async function cargar(session: Session | null) {
      if (!session) {
        if (activo) setEstado({ cargando: false, session: null, rol: null });
        return;
      }
      const { data } = await supabase
        .from('perfiles_staff')
        .select('rol')
        .eq('id', session.user.id)
        .maybeSingle();
      if (activo) {
        setEstado({
          cargando: false,
          session,
          rol: (data?.rol as Rol | undefined) ?? null,
        });
      }
    }

    supabase.auth.getSession().then(({ data }) => cargar(data.session));

    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEstado((prev) => ({ ...prev, cargando: true }));
        cargar(session);
      },
    );

    return () => {
      activo = false;
      subscripcion.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
