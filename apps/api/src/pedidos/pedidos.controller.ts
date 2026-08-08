import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import type { CrearPedidoInput } from './pedidos.service';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Post()
  crear(@Body() body: CrearPedidoInput) {
    return this.pedidos.crear(body);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.pedidos.obtener(id);
  }
}
