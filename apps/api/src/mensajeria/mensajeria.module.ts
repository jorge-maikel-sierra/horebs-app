import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CatalogModule } from '../catalog/catalog.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MetaGraphService } from './meta-graph.service';
import { GeminiService } from './gemini.service';
import { ConversacionesService } from './conversaciones.service';
import { SeguimientoService } from './seguimiento.service';

@Module({
  imports: [CatalogModule, PedidosModule, ScheduleModule.forRoot()],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    MetaGraphService,
    GeminiService,
    ConversacionesService,
    SeguimientoService,
  ],
  exports: [ConversacionesService, MetaGraphService],
})
export class MensajeriaModule {}
