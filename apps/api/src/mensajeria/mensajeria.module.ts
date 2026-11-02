import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ClientesModule } from '../clientes/clientes.module';
import { MailModule } from '../mail/mail.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MetaGraphService } from './meta-graph.service';
import { GeminiService } from './gemini.service';
import { GeminiClienteService } from './gemini-cliente.service';
import { HerramientasBotService } from './herramientas-bot.service';
import { DerivacionBotService } from './derivacion-bot.service';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import { ConversacionesService } from './conversaciones.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import { SeguimientoService } from './seguimiento.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { CheckoutEnviosService } from './checkout-envios.service';
import { CheckoutPedidoService } from './checkout-pedido.service';
import { CheckoutPreguntasService } from './checkout-preguntas.service';
import { AvisosPedidoService } from './avisos-pedido.service';
import { ComprobantesService } from './comprobantes.service';
import { MediaEntranteService } from './media-entrante.service';
import { RespuestaBotService } from './respuesta-bot.service';

@Module({
  imports: [CatalogModule, ClientesModule, MailModule, PedidosModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    MetaGraphService,
    GeminiService,
    GeminiClienteService,
    HerramientasBotService,
    DerivacionBotService,
    CalculoPedidoBotService,
    ConversacionesService,
    ConversionesMetaService,
    SeguimientoService,
    AvisoEquipoService,
    CheckoutWhatsappService,
    CheckoutEnviosService,
    CheckoutPedidoService,
    CheckoutPreguntasService,
    AvisosPedidoService,
    ComprobantesService,
    MediaEntranteService,
    RespuestaBotService,
  ],
  exports: [
    AvisosPedidoService,
    ConversacionesService,
    ConversionesMetaService,
    MetaGraphService,
  ],
})
export class MensajeriaModule {}
