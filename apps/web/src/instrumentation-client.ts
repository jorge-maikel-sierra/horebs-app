import posthog from 'posthog-js';
import { supabase } from '@/lib/supabase';

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Sin las variables (ej. un entorno local sin configurar) el sitio funciona
// igual: simplemente no se mide en PostHog.
if (token && host) {
  posthog.init(token, {
    api_host: host,
    defaults: '2026-08-30',
  });

  // Quien inicia sesión (cliente con cuenta o equipo del local) se identifica
  // con su id de Supabase, nunca con el correo; al salir se olvida.
  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (sesion?.user) {
      if (posthog.get_distinct_id() !== sesion.user.id) {
        posthog.identify(sesion.user.id);
      }
    } else if (evento === 'SIGNED_OUT') {
      posthog.reset();
    }
  });
}
