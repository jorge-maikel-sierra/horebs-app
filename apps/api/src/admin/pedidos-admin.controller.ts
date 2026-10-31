import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RolesGuard } from '../auth/roles.guard';
import type { UsuarioAutenticado } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario.decorator';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { PedidosComprobantesService } from '../pedidos/pedidos-comprobantes.service';
import { PedidosAdminService } from './pedidos-admin.service';
import { ValidarBodyPipe } from '../common/pipes/validar-body.pipe';
import { ESQUEMA_EDITAR_PEDIDO } from './esquemas';
import type { EditarPedidoInput, PedidoAdminDto } from './pedidos-admin.tipos';

/** Vigencia del link firmado al comprobante, en segundos (10 min). */
const VIGENCIA_COMPROBANTE_S = 10 * 60;

@Controller('admin/pedidos')
@UseGuards(RolesGuard)
export class PedidosAdminController {
  constructor(
    private readonly pedidosAdmin: PedidosAdminService,
    private readonly comprobantes: PedidosComprobantesService,
  ) {}

  @Get()
  @Roles('admin', 'empleado')
  listar(): Promise<PedidoAdminDto[]> {
    return this.pedidosAdmin.listarPedidos();
  }

  @Patch(':id')
  @Roles('admin', 'empleado')
  editar(
    @Param('id', UuidPipe) id: string,
    // `items` son líneas anidadas: el service las valida una por una.
    @Body(new ValidarBodyPipe(ESQUEMA_EDITAR_PEDIDO)) body: EditarPedidoInput,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<PedidoAdminDto> {
    return this.pedidosAdmin.editarPedido(id, body, usuario.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  eliminar(
    @Param('id', UuidPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.pedidosAdmin.eliminarPedido(id, usuario.id);
  }

  /** Link firmado al comprobante de transferencia que mandó el cliente. */
  @Get(':id/comprobante')
  @Roles('admin', 'empleado')
  async verComprobante(
    @Param('id', UuidPipe) id: string,
  ): Promise<{ url: string }> {
    const url = await this.comprobantes.urlComprobante(
      id,
      VIGENCIA_COMPROBANTE_S,
    );
    if (!url) {
      throw new NotFoundException('Este pedido no tiene comprobante.');
    }
    return { url };
  }

  @Get(':id/factura')
  @Roles('admin', 'empleado')
  async descargarFactura(
    @Param('id', UuidPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombreArchivo } =
      await this.pedidosAdmin.generarFacturaPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    return new StreamableFile(buffer);
  }
}
