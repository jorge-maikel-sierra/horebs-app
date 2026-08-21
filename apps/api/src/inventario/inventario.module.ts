import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { InsumosController } from './insumos.controller';
import { InsumosService } from './insumos.service';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { RecetasController } from './recetas.controller';
import { RecetasService } from './recetas.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { InventarioService } from './inventario.service';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [
    InsumosController,
    ComprasController,
    RecetasController,
    MovimientosController,
    ReportesController,
  ],
  providers: [
    InsumosService,
    ComprasService,
    RecetasService,
    MovimientosService,
    ReportesService,
    InventarioService,
  ],
  exports: [InventarioService],
})
export class InventarioModule {}
