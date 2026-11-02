import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { Ubicacion } from '../common/ubicacion.interceptor';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_VENTA } from './esquemas';
import type { CrearVentaInput, VentaDto } from './pedidos-admin.tipos';
import { VentasService } from './ventas.service';

@Controller('admin/ventas')
@UseGuards(RolesGuard)
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  @Ubicacion('/pedidos/:id')
  @Roles('admin', 'empleado')
  crear(
    // `cliente` e `items` son anidados: el service los valida campo por campo.
    @Body(new ValidarBodyPipe(ESQUEMA_VENTA)) body: CrearVentaInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<VentaDto> {
    return this.ventas.crearVenta(body, usuario.id);
  }
}
