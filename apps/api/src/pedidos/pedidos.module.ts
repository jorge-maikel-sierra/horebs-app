import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { PedidosConsultasService } from './pedidos-consultas.service';
import { PedidosComprobantesService } from './pedidos-comprobantes.service';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [MailModule, InventarioModule, ClientesModule],
  controllers: [PedidosController],
  providers: [
    PedidosService,
    PedidosConsultasService,
    PedidosComprobantesService,
  ],
  exports: [
    PedidosService,
    PedidosConsultasService,
    PedidosComprobantesService,
  ],
})
export class PedidosModule {}
