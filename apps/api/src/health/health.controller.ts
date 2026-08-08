import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async check() {
    const supabaseStatus = await this.supabase.ping();
    return {
      status: supabaseStatus.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      supabase: supabaseStatus,
    };
  }
}
