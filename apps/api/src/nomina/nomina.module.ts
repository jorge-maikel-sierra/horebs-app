import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';

@Module({
  imports: [AuthModule],
  controllers: [EmpleadosController, NominaController],
  providers: [EmpleadosService, NominaService],
})
export class NominaModule {}
