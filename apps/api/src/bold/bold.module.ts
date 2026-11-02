import { Module } from '@nestjs/common';
import { BoldService } from './bold.service';

@Module({
  providers: [BoldService],
  exports: [BoldService],
})
export class BoldModule {}
