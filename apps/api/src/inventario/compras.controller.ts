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
import {
  ESQUEMA_ACTUALIZAR_DETALLE,
  ESQUEMA_VINCULAR_DETALLE,
} from './esquemas';
import { Deprecada } from '../common/deprecacion.interceptor';

@Controller('inventario/compras')
@UseGuards(RolesGuard)
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get()
  @Roles('admin', 'empleado')
  listar() {
    return this.compras.listar();
  }

  @Post()
  @Roles('admin', 'empleado')
  crear(
    @Body() body: CrearCompraInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.compras.crear(body, usuario.id);
  }

  @Patch('detalles/:id')
  @HttpCode(204)
  @Roles('admin', 'empleado')
  async actualizarDetalle(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_ACTUALIZAR_DETALLE))
    body: { estado?: 'procesado' | 'excluido'; insumo_id?: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.compras.actualizarLinea(id, body, usuario.id);
  }

  @Patch('detalle/:id/procesar')
  @Deprecada('/inventario/compras/detalles/:id')
  @Roles('admin', 'empleado')
  async procesar(
    @Param('id', UuidPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    await this.compras.procesarLinea(id, usuario.id);
    return { ok: true };
  }

  @Patch('detalle/:id/excluir')
  @Deprecada('/inventario/compras/detalles/:id')
  @Roles('admin', 'empleado')
  async excluir(@Param('id', UuidPipe) id: string) {
    await this.compras.excluirLinea(id);
    return { ok: true };
  }

  @Patch('detalle/:id/vincular')
  @Deprecada('/inventario/compras/detalles/:id')
  @Roles('admin', 'empleado')
  async vincular(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_VINCULAR_DETALLE))
    body: { insumo_id: string },
  ) {
    await this.compras.vincularInsumo(id, body.insumo_id);
    return { ok: true };
  }
}
