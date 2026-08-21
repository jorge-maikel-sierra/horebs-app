import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PuntosController } from './puntos.controller';
import { PuntosPublicoController } from './puntos-publico.controller';
import { PuntosService } from './puntos.service';

@Module({
  imports: [SupabaseModule, MailModule, ScheduleModule.forRoot()],
  controllers: [ClientesController, PuntosController, PuntosPublicoController],
  providers: [ClientesService, PuntosService],
  exports: [ClientesService, PuntosService],
})
export class ClientesModule {}
