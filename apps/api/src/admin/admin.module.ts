import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ModulosService } from './modulos.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';
import { FacturaModule } from '../facturas/factura.module';
import { BlogModule } from '../blog/blog.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [
    AuthModule,
    MailModule,
    InventarioModule,
    MensajeriaModule,
    FacturaModule,
    BlogModule,
    ClientesModule,
    PedidosModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ModulosService],
})
export class AdminModule {}
