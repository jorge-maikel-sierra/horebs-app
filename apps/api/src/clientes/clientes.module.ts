import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';
import { ClientesController } from './clientes.controller';
import { ClientesDirectorioService } from './clientes-directorio.service';
import { ClientesService } from './clientes.service';
import { PuntosController } from './puntos.controller';
import { PuntosPublicoController } from './puntos-publico.controller';
import { PuntosService } from './puntos.service';

@Module({
  imports: [SupabaseModule, MailModule],
  controllers: [ClientesController, PuntosController, PuntosPublicoController],
  providers: [ClientesService, ClientesDirectorioService, PuntosService],
  exports: [ClientesService, PuntosService],
})
export class ClientesModule {}
