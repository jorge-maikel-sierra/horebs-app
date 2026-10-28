import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ClientesModule } from '../clientes/clientes.module';
import { MailModule } from '../mail/mail.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MetaGraphService } from './meta-graph.service';
import { GeminiService } from './gemini.service';
import { ConversacionesService } from './conversaciones.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import { SeguimientoService } from './seguimiento.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { AvisosPedidoService } from './avisos-pedido.service';
import { ComprobantesService } from './comprobantes.service';

@Module({
  imports: [CatalogModule, ClientesModule, MailModule, PedidosModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    MetaGraphService,
    GeminiService,
    ConversacionesService,
    ConversionesMetaService,
    SeguimientoService,
    AvisoEquipoService,
    CheckoutWhatsappService,
    AvisosPedidoService,
    ComprobantesService,
  ],
  exports: [
    AvisosPedidoService,
    ConversacionesService,
    ConversionesMetaService,
    MetaGraphService,
  ],
})
export class MensajeriaModule {}
