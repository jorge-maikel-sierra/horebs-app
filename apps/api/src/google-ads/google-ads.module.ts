import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleAdsAdminController } from './google-ads-admin.controller';
import { GoogleAdsIngestaService } from './google-ads-ingesta.service';
import { GoogleAdsTableroService } from './google-ads-tablero.service';
import { GoogleAdsWebhookController } from './google-ads-webhook.controller';

@Module({
  imports: [AuthModule],
  controllers: [GoogleAdsWebhookController, GoogleAdsAdminController],
  providers: [GoogleAdsIngestaService, GoogleAdsTableroService],
})
export class GoogleAdsModule {}
