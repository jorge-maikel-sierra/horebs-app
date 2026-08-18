import { Module } from '@nestjs/common';
import { FacturaService } from './factura.service';

@Module({
  providers: [FacturaService],
  exports: [FacturaService],
})
export class FacturaModule {}
