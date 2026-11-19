import posthog from 'posthog-js';
import { supabase } from '@/lib/supabase';

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
// Con el proxy administrado de PostHog es https://e.pizzeriahorebs.shop (así
// los bloqueadores de anuncios no frenan los eventos); sin proxy, el host de
// ingesta de PostHog.
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
// App de PostHog (https://us.posthog.com): hace falta cuando `host` es el
// proxy, para que la barra de herramientas y las grabaciones abran bien.
const uiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST;

// Sin las variables (ej. un entorno local sin configurar) el sitio funciona
// igual: simplemente no se mide en PostHog.
if (token && host) {
  posthog.init(token, {
    api_host: host,
    ...(uiHost ? { ui_host: uiHost } : {}),
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
