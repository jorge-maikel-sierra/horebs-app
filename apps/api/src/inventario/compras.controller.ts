import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { ComprasService } from './compras.service';
import type { CrearCompraInput } from './compras.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';

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

  @Patch('detalle/:id/procesar')
  @Roles('admin', 'empleado')
  async procesar(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    await this.compras.procesarLinea(id, usuario.id);
    return { ok: true };
  }

  @Patch('detalle/:id/excluir')
  @Roles('admin', 'empleado')
  async excluir(@Param('id') id: string) {
    await this.compras.excluirLinea(id);
    return { ok: true };
  }

  @Patch('detalle/:id/vincular')
  @Roles('admin', 'empleado')
  async vincular(@Param('id') id: string, @Body() body: { insumo_id: string }) {
    await this.compras.vincularInsumo(id, body.insumo_id);
    return { ok: true };
  }
}
