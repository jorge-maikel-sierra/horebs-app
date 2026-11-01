import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecetasService } from './recetas.service';
import type {
  CrearRecetaInput,
  CrearSubrecetaInput,
  RecetaDto,
  SubrecetaDto,
} from './recetas.tipos';
import { UuidPipe } from '../common/pipes/uuid.pipe';

// Los bodies traen `componentes[]` anidados: se validan línea por línea en
// `recetas-reglas.ts`, no con `ValidarBodyPipe`.
@Controller('inventario')
@UseGuards(RolesGuard)
export class RecetasController {
  constructor(private readonly recetas: RecetasService) {}

  @Get('subrecetas')
  @Roles('admin', 'empleado')
  listarSubrecetas(): Promise<SubrecetaDto[]> {
    return this.recetas.listarSubrecetas();
  }

  @Post('subrecetas')
  @Roles('admin')
  crearSubreceta(@Body() body: CrearSubrecetaInput): Promise<SubrecetaDto> {
    return this.recetas.crearSubreceta(body);
  }

  @Patch('subrecetas/:id')
  @Roles('admin')
  editarSubreceta(
    @Param('id', UuidPipe) id: string,
    @Body() body: CrearSubrecetaInput,
  ): Promise<SubrecetaDto> {
    return this.recetas.editarSubreceta(id, body);
  }

  @Get('recetas')
  @Roles('admin', 'empleado')
  listarRecetas(): Promise<RecetaDto[]> {
    return this.recetas.listarRecetas();
  }

  @Post('recetas')
  @Roles('admin')
  crearReceta(@Body() body: CrearRecetaInput): Promise<RecetaDto> {
    return this.recetas.crearReceta(body);
  }

  @Patch('recetas/:id')
  @Roles('admin')
  editarReceta(
    @Param('id', UuidPipe) id: string,
    @Body() body: CrearRecetaInput,
  ): Promise<RecetaDto> {
    return this.recetas.editarReceta(id, body);
  }
}
