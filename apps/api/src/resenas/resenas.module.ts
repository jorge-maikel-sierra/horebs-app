import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';
import { GoogleBusinessService } from './google-business.service';
import { ResenasAdminController } from './resenas-admin.controller';
import { ResenasService } from './resenas.service';

@Module({
  imports: [AuthModule, MensajeriaModule],
  controllers: [ResenasAdminController],
  providers: [GoogleBusinessService, ResenasService],
})
export class ResenasModule {}
