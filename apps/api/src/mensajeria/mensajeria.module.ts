import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MetaGraphService } from './meta-graph.service';
import { BotFlowService } from './bot-flow.service';
import { ConversacionesService } from './conversaciones.service';

@Module({
  imports: [CatalogModule, PedidosModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    MetaGraphService,
    BotFlowService,
    ConversacionesService,
  ],
})
export class MensajeriaModule {}
