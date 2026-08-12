import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecetasService } from './recetas.service';
import type { CrearRecetaInput, CrearSubrecetaInput } from './recetas.service';

@Controller('inventario')
@UseGuards(RolesGuard)
export class RecetasController {
  constructor(private readonly recetas: RecetasService) {}

  @Get('subrecetas')
  @Roles('admin', 'empleado')
  listarSubrecetas() {
    return this.recetas.listarSubrecetas();
  }

  @Post('subrecetas')
  @Roles('admin')
  crearSubreceta(@Body() body: CrearSubrecetaInput) {
    return this.recetas.crearSubreceta(body);
  }

  @Patch('subrecetas/:id')
  @Roles('admin')
  editarSubreceta(@Param('id') id: string, @Body() body: CrearSubrecetaInput) {
    return this.recetas.editarSubreceta(id, body);
  }

  @Get('recetas')
  @Roles('admin', 'empleado')
  listarRecetas() {
    return this.recetas.listarRecetas();
  }

  @Post('recetas')
  @Roles('admin')
  crearReceta(@Body() body: CrearRecetaInput) {
    return this.recetas.crearReceta(body);
  }

  @Patch('recetas/:id')
  @Roles('admin')
  editarReceta(@Param('id') id: string, @Body() body: CrearRecetaInput) {
    return this.recetas.editarReceta(id, body);
  }
}
