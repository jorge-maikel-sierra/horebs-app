import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [AuthModule, MailModule, InventarioModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
