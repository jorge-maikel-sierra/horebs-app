import { Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [RolesGuard, SupabaseAuthGuard],
  exports: [RolesGuard, SupabaseAuthGuard],
})
export class AuthModule {}
