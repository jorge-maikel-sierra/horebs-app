import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_MODULO } from './esquemas';
import { ModulosService } from './modulos.service';

@Controller('admin/modulos')
@UseGuards(RolesGuard)
export class ModulosController {
  constructor(private readonly modulos: ModulosService) {}

  // Lectura para todo el staff (el menú y las pantallas la necesitan);
  // solo el admin puede encender o apagar un módulo.
  @Get()
  @Roles('admin', 'empleado')
  listar() {
    return this.modulos.listar();
  }

  // `:id` es la clave del módulo ('pos', 'nomina'...), no un uuid.
  @Patch(':id')
  @Roles('admin')
  cambiar(
    @Param('id') id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_MODULO)) body: { activo?: unknown },
  ) {
    return this.modulos.cambiar(id, body?.activo);
  }
}
