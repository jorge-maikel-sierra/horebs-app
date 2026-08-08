import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * Módulo global: cualquier otro módulo del API puede inyectar
 * SupabaseService sin volver a importarlo explícitamente.
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
