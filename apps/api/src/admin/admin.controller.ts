import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { AdminService } from './admin.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import type { CrearVentaInput, ItemVentaInput } from './admin.service';
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

  @Get('pedidos')
  @Roles('admin', 'empleado')
  listarPedidos() {
    return this.admin.listarPedidos();
  }

  @Patch('pedidos/:id')
  @Roles('admin', 'empleado')
  editarPedido(
    @Param('id') id: string,
    @Body()
    body: {
      metodo_pago?: string;
      items?: ItemVentaInput[];
    },
  ) {
    return this.admin.editarPedido(id, body);
  }

  @Get('clientes')
  @Roles('admin', 'empleado')
  buscarClientes(@Query('q') q?: string) {
    return this.admin.buscarClientes(q ?? '');
  }

  @Patch('clientes/:id')
  @Roles('admin', 'empleado')
  editarCliente(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      apellido?: string;
      telefono?: string;
      direccion?: string;
      correo?: string;
    },
  ) {
    return this.admin.editarCliente(id, body);
  }

  @Get('configuracion')
  @Roles('admin')
  obtenerConfiguracion() {
    return this.admin.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles('admin')
  actualizarConfiguracion(
    @Body() body: { correo_domiciliario: string },
  ) {
    return this.admin.actualizarConfiguracion(body.correo_domiciliario);
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
