import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import type { AjustePuntosInput, MovimientoPuntosDto } from './puntos.tipos';
import type {
  ConsultaDirectorio,
  DirectorioClientesDto,
} from './clientes-directorio.service';
import type {
  ClienteDetalleDto,
  ClienteDto,
  EditarClienteInput,
  PedidoClienteDto,
} from './clientes.tipos';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Deprecada } from '../common/deprecacion.interceptor';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_AJUSTE_PUNTOS, ESQUEMA_EDITAR_CLIENTE } from './esquemas';

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
  listarOBuscar(
    @Query() query: ConsultaDirectorio,
  ): Promise<DirectorioClientesDto | ClienteDto[]> {
    if (query.vista === 'directorio') return this.directorio.consultar(query);
    return query.q?.trim()
      ? this.clientes.buscar(query.q)
      : this.clientes.listar();
  }

  // Declarada antes de ':id' para que "directorio" no se tome como un id.
  @Get('directorio')
  @Deprecada('/admin/clientes?vista=directorio')
  @Roles('admin', 'empleado')
  consultarDirectorio(
    @Query() query: ConsultaDirectorio,
  ): Promise<DirectorioClientesDto> {
    return this.directorio.consultar(query);
  }

  @Get(':id')
  @Roles('admin', 'empleado')
  obtenerDetalle(
    @Param('id', UuidPipe) id: string,
  ): Promise<ClienteDetalleDto> {
    return this.clientes.obtenerDetalle(id);
  }

  @Get(':id/pedidos')
  @Roles('admin', 'empleado')
  listarPedidos(
    @Param('id', UuidPipe) id: string,
  ): Promise<PedidoClienteDto[]> {
    return this.clientes.listarPedidos(id);
  }

  @Patch(':id')
  @Roles('admin', 'empleado')
  editar(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_CLIENTE))
    body: EditarClienteInput,
  ): Promise<ClienteDto> {
    return this.clientes.editar(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  eliminar(@Param('id', UuidPipe) id: string): Promise<void> {
    return this.clientes.eliminar(id);
  }

  @Get(':id/movimientos-puntos')
  @Roles('admin', 'empleado')
  listarMovimientosPuntos(
    @Param('id', UuidPipe) id: string,
  ): Promise<MovimientoPuntosDto[]> {
    return this.puntos.listarMovimientos(id);
  }

  @Post(':id/movimientos-puntos')
  @Roles('admin')
  ajustarPuntos(
    @Param('id', UuidPipe) id: string,
    @Body(new ValidarBodyPipe(ESQUEMA_AJUSTE_PUNTOS))
    body: AjustePuntosInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<number> {
    return this.puntos.ajustarPuntos(id, body.puntos, body.motivo, usuario.id);
  }
}
