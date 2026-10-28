import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  EmpleadosService,
  type CrearEmpleadoInput,
  type EditarEmpleadoInput,
} from './empleados.service';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_CREAR_EMPLEADO, ESQUEMA_EDITAR_EMPLEADO } from './esquemas';

@Controller('nomina/empleados')
@UseGuards(RolesGuard)
export class EmpleadosController {
  constructor(private readonly empleados: EmpleadosService) {}

  @Get()
  @Roles('admin')
  listar(@Query('activos') activos?: string) {
    return this.empleados.listar(activos === 'true');
  }

  @Post()
  @Roles('admin')
  crear(
    @Body(new ValidarBodyPipe(ESQUEMA_CREAR_EMPLEADO))
    body: CrearEmpleadoInput,
  ) {
    return this.empleados.crear(body);
  }

  @Patch(':id')
  @Roles('admin')
  editar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_EMPLEADO))
    body: EditarEmpleadoInput,
  ) {
    return this.empleados.editar(id, body);
  }
}
