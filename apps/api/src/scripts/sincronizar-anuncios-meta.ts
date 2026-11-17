/**
 * Trae de Meta el gasto de los anuncios desde una fecha (por defecto, los
 * últimos 30 días) y lo guarda en `anuncios_meta_diario`. Es seguro repetirlo:
 * hace upsert por día y anuncio.
 *
 *   railway run npx ts-node -r tsconfig-paths/register src/scripts/sincronizar-anuncios-meta.ts 2026-10-01
 *
 * Necesita en el entorno SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * META_AD_ACCOUNT_ID y el token de Meta (las de Railway).
 */
import { ConfigService } from '@nestjs/config';
import { AnunciosMetaService } from '../admin/anuncios-meta.service';
import { SupabaseService } from '../supabase/supabase.service';

async function main(): Promise<void> {
  const desde = process.argv[2];
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    throw new Error('Uso: sincronizar-anuncios-meta.ts [AAAA-MM-DD]');
  }
  const config = new ConfigService();
  const servicio = new AnunciosMetaService(config, new SupabaseService(config));
  const resultado = await servicio.sincronizar(desde);
  process.stdout.write(`${JSON.stringify(resultado)}\n`);
}

main().catch((err: Error) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
