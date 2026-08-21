import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para uso del lado del servidor (NestJS).
 * Usa la SERVICE ROLE KEY — nunca exponer esta key al frontend.
 * El frontend (Next.js) debe usar la ANON KEY por separado.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas. ' +
          'Copia apps/api/.env.example a apps/api/.env y completa los valores.',
      );
    }

    this.client = createClient(url ?? '', serviceRoleKey ?? '', {
      auth: { persistSession: false },
    });
  }

  onModuleInit() {
    this.logger.log('Cliente de Supabase inicializado');
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Verifica conectividad real contra Supabase (para /health). `auth.getSession()`
   * es una lectura local en memoria y nunca llega a hacer un request — por eso
   * se pega directo a PostgREST contra una tabla que siempre existe.
   */
  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await this.client.from('configuracion').select('clave').limit(1);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
