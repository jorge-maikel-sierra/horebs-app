/**
 * Muestra cuántos clientes entran a cada público de Meta sin enviar nada; con
 * --enviar los refresca de verdad (solo si META_AUDIENCIAS_ACTIVAS=true).
 *
 *   railway run npx ts-node -r tsconfig-paths/register src/scripts/audiencias-meta.ts
 *   railway run npx ts-node -r tsconfig-paths/register src/scripts/audiencias-meta.ts --enviar
 *
 * Necesita en el entorno SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * META_AD_ACCOUNT_ID y el token de Meta (las de Railway).
 */
import { ConfigService } from '@nestjs/config';
import { AudienciasMetaService } from '../admin/audiencias-meta.service';
import { SupabaseService } from '../supabase/supabase.service';

const SANGRIA = 2;

async function main(): Promise<void> {
  const config = new ConfigService();
  const servicio = new AudienciasMetaService(
    config,
    new SupabaseService(config),
  );
  const resultado = process.argv.includes('--enviar')
    ? await servicio.sincronizar()
    : await servicio.panel();
  process.stdout.write(`${JSON.stringify(resultado, null, SANGRIA)}\n`);
}

main().catch((err: Error) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
