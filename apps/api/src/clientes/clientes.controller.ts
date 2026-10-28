import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { ClientesDirectorioService } from './clientes-directorio.service';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import type { ConsultaDirectorio } from './clientes-directorio.service';
import type { EditarClienteInput } from './clientes.service';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_AJUSTE_PUNTOS } from './esquemas';

@Controller('admin/clientes')
@UseGuards(RolesGuard)
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly directorio: ClientesDirectorioService,
    private readonly puntos: PuntosService,
  ) {}

  @Get()
  @Roles('admin', 'empleado')
  listarOBuscar(@Query('q') q?: string) {
    return q?.trim() ? this.clientes.buscar(q) : this.clientes.listar();
  }

  // Declarada antes de ':id' para que "directorio" no se tome como un id.
  @Get('directorio')
  @Roles('admin', 'empleado')
  consultarDirectorio(@Query() query: ConsultaDirectorio) {
    return this.directorio.consultar(query);
  }

  @Get(':id')
  @Roles('admin', 'empleado')
  obtenerDetalle(@Param('id', UuidPipe) id: string) {
    return this.clientes.obtenerDetalle(id);
  }

  @Get(':id/pedidos')
  @Roles('admin', 'empleado')
  listarPedidos(@Param('id', UuidPipe) id: string) {
    return this.clientes.listarPedidos(id);
  }

  @Patch(':id')
  @Roles('admin', 'empleado')
  editar(@Param('id', UuidPipe) id: string, @Body() body: EditarClienteInput) {
    return this.clientes.editar(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  eliminar(@Param('id', UuidPipe) id: string) {
    return this.clientes.eliminar(id);
  }

  @Get(':id/movimientos-puntos')
  @Roles('admin', 'empleado')
  listarMovimientosPuntos(@Param('id', UuidPipe) id: string) {
    return this.puntos.listarMovimientos(id);
  }

  @Post(':id/ajuste-puntos')
  @Roles('admin')
  ajustarPuntos(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_AJUSTE_PUNTOS))
    body: { puntos: number; motivo: string },
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.puntos.ajustarPuntos(id, body.puntos, body.motivo, usuario.id);
  }
}
