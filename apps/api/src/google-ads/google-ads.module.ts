import { Module } from '@nestjs/common';
import { GoogleAdsIngestaService } from './google-ads-ingesta.service';
import { GoogleAdsWebhookController } from './google-ads-webhook.controller';

@Module({
  controllers: [GoogleAdsWebhookController],
  providers: [GoogleAdsIngestaService],
})
export class GoogleAdsModule {}
