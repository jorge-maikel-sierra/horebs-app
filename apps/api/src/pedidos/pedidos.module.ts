import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [MailModule, InventarioModule],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
