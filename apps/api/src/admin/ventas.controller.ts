import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { Ubicacion } from '../common/ubicacion.interceptor';
import type { CrearVentaInput } from './pedidos-admin.tipos';
import { VentasService } from './ventas.service';

@Controller('admin/ventas')
@UseGuards(RolesGuard)
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  @Ubicacion('/pedidos/:id')
  @Roles('admin', 'empleado')
  crear(
    @Body() body: CrearVentaInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ventas.crearVenta(body, usuario.id);
  }
}
