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
import { UsuarioActual } from '../auth/usuario.decorator';
import { InsumosService } from './insumos.service';
import type {
  AjusteStockInput,
  CrearInsumoInput,
  EditarInsumoInput,
  InsumoDto,
} from './insumos.tipos';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import {
  ESQUEMA_AJUSTE_INSUMO,
  ESQUEMA_CREAR_INSUMO,
  ESQUEMA_EDITAR_INSUMO,
} from './esquemas';

@Controller('inventario/insumos')
@UseGuards(RolesGuard)
export class InsumosController {
  constructor(private readonly insumos: InsumosService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(@Query('stockBajo') stockBajo?: string): Promise<InsumoDto[]> {
    return this.insumos.listar(stockBajo === 'true');
  }

  @Post()
  @Roles('admin', 'empleado')
  crear(
    @Body(new ValidarBodyPipe(ESQUEMA_CREAR_INSUMO)) body: CrearInsumoInput,
  ): Promise<InsumoDto> {
    return this.insumos.crear(body);
  }

  @Patch(':id')
  @Roles('admin', 'empleado')
  editar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_INSUMO))
    body: EditarInsumoInput,
  ): Promise<InsumoDto> {
    return this.insumos.editar(id, body);
  }

  @Post(':id/ajustes')
  @Roles('admin', 'empleado')
  ajustarStock(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_AJUSTE_INSUMO)) body: AjusteStockInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<InsumoDto> {
    return this.insumos.ajustarStock(id, body, usuario.id);
  }
}
