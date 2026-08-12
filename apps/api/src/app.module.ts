import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    HealthModule,
    CatalogModule,
    PedidosModule,
    AdminModule,
    BlogModule,
    TurnosModule,
    InformesModule,
    InventarioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
