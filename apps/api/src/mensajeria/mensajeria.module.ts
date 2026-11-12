import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ClientesModule } from '../clientes/clientes.module';
import { BoldModule } from '../bold/bold.module';
import { MailModule } from '../mail/mail.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { BoldWebhookController } from './bold-webhook.controller';
import { OrigenConversacionService } from './origen-conversacion.service';
import { RegistroEntranteService } from './registro-entrante.service';
import { ConfirmacionPedidoService } from './confirmacion-pedido.service';
import { PagoBoldService } from './pago-bold.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { MetaGraphService } from './meta-graph.service';
import { DespachoHerramientasService } from './despacho-herramientas.service';
import { EnvioHerramientasService } from './envio-herramientas.service';
import { GeminiService } from './gemini.service';
import { ResumenPedidoBotService } from './resumen-pedido-bot.service';
import { GeminiClienteService } from './gemini-cliente.service';
import { HerramientasBotService } from './herramientas-bot.service';
import { DerivacionBotService } from './derivacion-bot.service';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import { ConversacionesService } from './conversaciones.service';
import { ConversionesMetaService } from './conversiones-meta.service';
import { ConversionesSocialService } from './conversiones-social.service';
import { SeguimientoService } from './seguimiento.service';
import { AvisoEquipoService } from './aviso-equipo.service';
import { CheckoutWhatsappService } from './checkout-whatsapp.service';
import { CheckoutEnviosService } from './checkout-envios.service';
import { CheckoutHistorialService } from './checkout-historial.service';
import { CheckoutPedidoService } from './checkout-pedido.service';
import { CheckoutPreguntasService } from './checkout-preguntas.service';
import { AvisosPedidoService } from './avisos-pedido.service';
import { RecomprasService } from './recompras.service';
import { ComprobantesService } from './comprobantes.service';
import { MediaEntranteService } from './media-entrante.service';
import { RespuestaBotService } from './respuesta-bot.service';
import { AtencionDeterministaService } from './atencion-determinista.service';
import { PedidoSocialService } from './pedido-social.service';
import { RespuestaSocialService } from './respuesta-social.service';

@Module({
  imports: [
    BoldModule,
    CatalogModule,
    ClientesModule,
    MailModule,
    PedidosModule,
  ],
  controllers: [WebhooksController, BoldWebhookController],
  providers: [
    WebhooksService,
    MetaGraphService,
    GeminiService,
    DespachoHerramientasService,
    EnvioHerramientasService,
    ResumenPedidoBotService,
    GeminiClienteService,
    HerramientasBotService,
    DerivacionBotService,
    CalculoPedidoBotService,
    ConversacionesService,
    ConversionesMetaService,
    ConversionesSocialService,
    SeguimientoService,
    AvisoEquipoService,
    CheckoutWhatsappService,
    CheckoutEnviosService,
    CheckoutHistorialService,
    CheckoutPedidoService,
    CheckoutPreguntasService,
    AvisosPedidoService,
    RecomprasService,
    ComprobantesService,
    MediaEntranteService,
    RespuestaBotService,
    AtencionDeterministaService,
    PedidoSocialService,
    RespuestaSocialService,
    PagoBoldService,
    ConfirmacionPedidoService,
    OrigenConversacionService,
    RegistroEntranteService,
  ],
  exports: [
    AvisosPedidoService,
    ConversacionesService,
    ConversionesMetaService,
    ConversionesSocialService,
    MetaGraphService,
  ],
})
export class MensajeriaModule {}
