import { Module } from '@nestjs/common';
import { EventosWebController } from './eventos-web.controller';
import { EventosWebService } from './eventos-web.service';

@Module({
  controllers: [EventosWebController],
  providers: [EventosWebService],
})
export class EventosWebModule {}
