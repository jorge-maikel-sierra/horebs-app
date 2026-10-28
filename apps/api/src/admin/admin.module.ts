import { Module } from '@nestjs/common';
import { ConfiguracionAdminController } from './configuracion-admin.controller';
import { ConfiguracionAdminService } from './configuracion-admin.service';
import { ModulosController } from './modulos.controller';
import { ModulosService } from './modulos.service';
import { PedidosAdminController } from './pedidos-admin.controller';
import { PedidosAdminService } from './pedidos-admin.service';
import { SeguimientoAdminController } from './seguimiento-admin.controller';
import { SeguimientoAdminService } from './seguimiento-admin.service';
import { UsuariosAdminController } from './usuarios-admin.controller';
import { UsuariosAdminService } from './usuarios-admin.service';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InventarioModule } from '../inventario/inventario.module';
import { MensajeriaModule } from '../mensajeria/mensajeria.module';
import { FacturaModule } from '../facturas/factura.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [
    AuthModule,
    MailModule,
    InventarioModule,
    MensajeriaModule,
    FacturaModule,
    ClientesModule,
    PedidosModule,
  ],
  controllers: [
    VentasController,
    PedidosAdminController,
    UsuariosAdminController,
    ConfiguracionAdminController,
    ModulosController,
    SeguimientoAdminController,
  ],
  providers: [
    VentasService,
    PedidosAdminService,
    UsuariosAdminService,
    ConfiguracionAdminService,
    SeguimientoAdminService,
    ModulosService,
  ],
})
export class AdminModule {}
