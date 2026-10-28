import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import type { CrearPedidoInput } from './pedidos.service';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { Ubicacion } from '../common/ubicacion.interceptor';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Post()
  @Ubicacion('/pedidos/:id')
  crear(@Body() body: CrearPedidoInput) {
    return this.pedidos.crear(body);
  }

  @Get(':id')
  obtener(@Param('id', UuidPipe) id: string) {
    return this.pedidos.obtener(id);
  }
}
