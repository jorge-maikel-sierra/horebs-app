import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { AdminModule } from './admin/admin.module';
import { BlogModule } from './blog/blog.module';
import { TurnosModule } from './turnos/turnos.module';
import { InformesModule } from './informes/informes.module';
import { InventarioModule } from './inventario/inventario.module';
import { MensajeriaModule } from './mensajeria/mensajeria.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite generoso por IP — pensado para frenar abuso/scraping, no
    // para restringir el uso normal del POS o el checkout.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    SupabaseModule,
    HealthModule,
    CatalogModule,
    PedidosModule,
    AdminModule,
    BlogModule,
    TurnosModule,
    InformesModule,
    InventarioModule,
    MensajeriaModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
