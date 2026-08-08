import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Solo advertencia en consola — evita romper el build si aún no están configuradas.
  // eslint-disable-next-line no-console
  console.warn(
    'NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas. ' +
      'Copia apps/web/.env.local.example a apps/web/.env.local y completa los valores.',
  );
}

// Cliente público — solo usar la ANON key aquí, nunca la service role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
