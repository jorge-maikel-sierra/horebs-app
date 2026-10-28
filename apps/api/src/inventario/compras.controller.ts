import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { ComprasService } from './compras.service';
import type { CrearCompraInput } from './compras.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_ACTUALIZAR_DETALLE } from './esquemas';

@Controller('inventario/compras')
@UseGuards(RolesGuard)
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar() {
    return this.compras.listar();
  }

  // Sin ValidarBodyPipe: el body trae el arreglo anidado `detalle`, que el
  // service valida línea por línea (el esquema plano no lo cubre).
  @Post()
  @Roles('admin', 'empleado')
  crear(
    @Body() body: CrearCompraInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.compras.crear(body, usuario.id);
  }

  @Patch('detalles/:id')
  @HttpCode(200)
  @Roles('admin', 'empleado')
  async actualizarDetalle(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ACTUALIZAR_DETALLE))
    body: { estado?: 'procesado' | 'excluido'; insumo_id?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    await this.compras.actualizarLinea(id, body, usuario.id);
    return { ok: true };
  }
}
