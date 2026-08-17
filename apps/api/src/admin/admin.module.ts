import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';

@Module({
  imports: [AuthModule, MailModule, InventarioModule, MensajeriaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
