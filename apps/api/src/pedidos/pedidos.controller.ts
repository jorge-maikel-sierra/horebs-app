import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import type { CrearPedidoInput, PedidoDto } from './pedidos.tipos';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { Ubicacion } from '../common/ubicacion.interceptor';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  // Sin ValidarBodyPipe: el body trae `items[]` y `cliente` anidados, que se
  // validan en `validar-pedido.ts` y `calcular-items.ts`.
  @Post()
  @Ubicacion('/pedidos/:id')
  crear(@Body() body: CrearPedidoInput): Promise<PedidoDto> {
    return this.pedidos.crear(body);
  }

  @Get(':id')
  obtener(@Param('id', UuidPipe) id: string): Promise<PedidoDto> {
    return this.pedidos.obtener(id);
  }
}
