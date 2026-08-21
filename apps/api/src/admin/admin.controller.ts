import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { AdminService } from './admin.service';
import { BlogService } from '../blog/blog.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import type { CrearVentaInput, ItemVentaInput } from './admin.service';
import type { CrearBlogPostInput } from '../blog/blog.service';
import type { Rol } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly blog: BlogService,
  ) {}

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
      estado?: string;
      items?: ItemVentaInput[];
    },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.admin.editarPedido(id, body, usuario.id);
  }

  @Delete('pedidos/:id')
  @Roles('admin')
  eliminarPedido(
    @Param('id') id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.admin.eliminarPedido(id, usuario.id);
  }

  @Get('pedidos/:id/factura')
  @Roles('admin', 'empleado')
  async descargarFactura(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.admin.generarFacturaPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    return new StreamableFile(buffer);
  }

  @Post('pedidos/:id/factura/correo')
  @Roles('admin', 'empleado')
  enviarFacturaPorCorreo(@Param('id') id: string) {
    return this.admin.enviarFacturaPorCorreo(id);
  }

  @Post('pedidos/:id/factura/whatsapp')
  @Roles('admin', 'empleado')
  enviarFacturaPorWhatsapp(@Param('id') id: string) {
    return this.admin.enviarFacturaPorWhatsapp(id);
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

  @Get('seguimiento/configuracion')
  @Roles('admin')
  obtenerConfiguracionSeguimiento() {
    return this.admin.obtenerConfiguracionSeguimiento();
  }

  @Patch('seguimiento/configuracion')
  @Roles('admin')
  actualizarConfiguracionSeguimiento(
    @Body() body: { recordatorio_minutos: number; oferta_minutos: number },
  ) {
    return this.admin.actualizarConfiguracionSeguimiento(
      Number(body.recordatorio_minutos),
      Number(body.oferta_minutos),
    );
  }

  @Get('seguimiento/conversaciones')
  @Roles('admin')
  listarConversacionesBot() {
    return this.admin.listarConversacionesBot();
  }

  @Patch('seguimiento/conversaciones/:id')
  @Roles('admin')
  actualizarEstadoConversacion(
    @Param('id') id: string,
    @Body() body: { estado: string },
  ) {
    return this.admin.actualizarEstadoConversacion(id, body.estado);
  }

  @Get('blog')
  @Roles('admin')
  listarBlogPosts() {
    return this.blog.listarBlogPosts();
  }

  @Post('blog')
  @Roles('admin')
  crearBlogPost(@Body() body: CrearBlogPostInput) {
    return this.blog.crearBlogPost(body);
  }

  @Patch('blog/:id')
  @Roles('admin')
  actualizarBlogPost(
    @Param('id') id: string,
    @Body() body: Partial<CrearBlogPostInput>,
  ) {
    return this.blog.actualizarBlogPost(id, body);
  }

  @Delete('blog/:id')
  @Roles('admin')
  eliminarBlogPost(@Param('id') id: string) {
    return this.blog.eliminarBlogPost(id);
  }
}
