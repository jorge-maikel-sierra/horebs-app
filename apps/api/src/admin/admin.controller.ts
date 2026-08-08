import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { AdminService } from './admin.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import type { CrearVentaInput } from './admin.service';
import type { Rol } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('perfil')
  @Roles('admin', 'empleado')
  getPerfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return usuario;
  }

  @Post('ventas')
  @Roles('admin', 'empleado')
  crearVenta(
    @Body() body: CrearVentaInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.admin.crearVenta(body, usuario.id);
  }

  @Get('usuarios')
  @Roles('admin')
  listarUsuarios() {
    return this.admin.listarUsuarios();
  }

  @Post('usuarios')
  @Roles('admin')
  asignarRol(@Body() body: { email: string; rol: Rol }) {
    return this.admin.asignarRol(body.email, body.rol);
  }

  @Delete('usuarios/:id')
  @Roles('admin')
  quitarRol(@Param('id') id: string) {
    return this.admin.quitarRol(id);
  }
}
