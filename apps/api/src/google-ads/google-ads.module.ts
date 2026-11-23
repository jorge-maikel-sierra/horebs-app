import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { GoogleAdsAdminController } from './google-ads-admin.controller';
import { GoogleAdsAvisosService } from './google-ads-avisos.service';
import { GoogleAdsIngestaService } from './google-ads-ingesta.service';
import { GoogleAdsTableroService } from './google-ads-tablero.service';
import { GoogleAdsWebhookController } from './google-ads-webhook.controller';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [GoogleAdsWebhookController, GoogleAdsAdminController],
  providers: [
    GoogleAdsIngestaService,
    GoogleAdsTableroService,
    GoogleAdsAvisosService,
  ],
})
export class GoogleAdsModule {}
