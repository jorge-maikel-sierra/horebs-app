/**
 * Carga a Meta las ventas de caja ya registradas (una sola vez). Es seguro
 * repetirlo: cada pedido se envía una vez (`eventos_meta_enviados`) y no
 * escribe pedidos. Arma los servicios a mano en vez de levantar AppModule
 * para no arrancar los cron del bot desde esta máquina.
 *
 *   npx ts-node -r tsconfig-paths/register src/scripts/enviar-compras-caja.ts 2026-11-01
 *
 * Necesita en el entorno SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * META_EVENTS_ACCESS_TOKEN y META_DATASET_ID_SOCIAL (las de Railway).
 */
import { ConfigService } from '@nestjs/config';
import { ConversionesCajaService } from '../mensajeria/conversiones-caja.service';
import { ConversionesMetaService } from '../mensajeria/conversiones-meta.service';
import { ConversionesSocialService } from '../mensajeria/conversiones-social.service';
import { OrigenConversacionService } from '../mensajeria/origen-conversacion.service';
import { SupabaseService } from '../supabase/supabase.service';
import { leerVentasCaja } from './ventas-caja';

async function main(): Promise<void> {
  const desde = process.argv[2];
  if (!desde || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    throw new Error('Uso: enviar-compras-caja.ts AAAA-MM-DD');
  }
  const config = new ConfigService();
  const supabase = new SupabaseService(config);
  const social = new ConversionesSocialService(config, supabase);
  const whatsapp = new ConversionesMetaService(
    config,
    supabase,
    new OrigenConversacionService(supabase),
    social,
  );
  const caja = new ConversionesCajaService(config, supabase, whatsapp);

  const ventas = await leerVentasCaja(supabase.getClient(), desde);
  const conteo = new Map<string, number>();
  for (const venta of ventas) {
    const resultado = await caja.enviarVenta(venta);
    conteo.set(resultado, (conteo.get(resultado) ?? 0) + 1);
  }
  process.stdout.write(
    `${ventas.length} ventas de caja desde ${desde}: ${JSON.stringify(Object.fromEntries(conteo))}\n`,
  );
}

main().catch((err: Error) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
