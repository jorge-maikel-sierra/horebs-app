import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmpleadosService, type CrearEmpleadoInput, type EditarEmpleadoInput } from './empleados.service';

@Controller('nomina/empleados')
@UseGuards(RolesGuard)
@Roles('admin')
export class EmpleadosController {
  constructor(private readonly empleados: EmpleadosService) {}

  @Get()
  listar(@Query('activos') activos?: string) {
    return this.empleados.listar(activos === 'true');
  }

  @Post()
  crear(@Body() body: CrearEmpleadoInput) {
    return this.empleados.crear(body);
  }

  @Patch(':id')
  editar(@Param('id') id: string, @Body() body: EditarEmpleadoInput) {
    return this.empleados.editar(id, body);
  }

  @Post(':id/desactivar')
  desactivar(@Param('id') id: string) {
    return this.empleados.desactivar(id);
  }

  @Post(':id/activar')
  activar(@Param('id') id: string) {
    return this.empleados.activar(id);
  }
}
