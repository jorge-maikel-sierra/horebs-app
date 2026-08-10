'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type EstadoSesion = {
  cargando: boolean;
  session: Session | null;
};

/** Sesión de Supabase del lado del cliente, para gatear UI (comentarios, likes). */
export function useSession(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>({
    cargando: true,
    session: null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEstado({ cargando: false, session: data.session });
    });

    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setEstado({ cargando: false, session });
      },
    );

    return () => subscripcion.subscription.unsubscribe();
  }, []);

  return estado;
}
