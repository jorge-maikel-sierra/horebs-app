import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { conReintentoPorReloj } from './reintento-reloj';

export interface EstadoSupabase {
  ok: boolean;
  error?: string;
}

/**
 * Cliente de Supabase para uso del lado del servidor (NestJS).
 * Usa la SERVICE ROLE KEY — nunca exponer esta key al frontend.
 * El frontend (Next.js) debe usar la ANON KEY por separado.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: ReturnType<typeof createClient>;

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
      global: {
        fetch: conReintentoPorReloj(fetch, () =>
          this.logger.warn(
            'Supabase rechazó la llave por desfase de reloj — se reintenta la llamada.',
          ),
        ),
      },
    });
  }

  onModuleInit(): void {
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
  async ping(): Promise<EstadoSupabase> {
    try {
      const { error } = await this.client
        .from('configuracion')
        .select('clave')
        .limit(1);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
