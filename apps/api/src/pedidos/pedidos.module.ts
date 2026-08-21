import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [MailModule, InventarioModule, ClientesModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
