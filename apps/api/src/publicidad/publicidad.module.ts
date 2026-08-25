import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InformesModule } from '../informes/informes.module';
import { PublicidadController } from './publicidad.controller';
import { MetaAdsGraphService } from './meta-ads-graph.service';
import { MetaAdsSnapshotService } from './meta-ads-snapshot.service';

// No vuelve a llamar ScheduleModule.forRoot() — ya está registrado
// globalmente por MensajeriaModule, y @nestjs/schedule lo expone app-wide
// una vez registrado en cualquier módulo.
@Module({
  imports: [AuthModule, InformesModule],
  controllers: [PublicidadController],
  providers: [MetaAdsGraphService, MetaAdsSnapshotService],
})
export class PublicidadModule {}
